-- Passed is its own state, separate from deal_stage.
-- Original columns (tier, passed, pass_reason, updated_at, text fields) are not written.
-- Deals whose stage was set to 'Passed' by the earlier backfill are given a real stage.
-- Their previous deal_stage is kept in private.passed_stage_restore so this can be undone.
-- Requires 20261003130100_deal_stage.sql.

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS is_passed boolean NOT NULL DEFAULT false;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS passed_at timestamptz;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS passed_reason text;

CREATE TABLE IF NOT EXISTS private.passed_stage_restore (
  deal_id uuid PRIMARY KEY REFERENCES public.deals (id) ON DELETE CASCADE,
  previous_stage text
);

CREATE TEMP TABLE _passed_state_reenable (tgname name);

INSERT INTO _passed_state_reenable (tgname)
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.deals'::regclass
  AND tgname IN ('deals_updated_at', 'deals_derive_fields', 'deals_stage_history')
  AND tgenabled <> 'D';

DO $$
DECLARE
  trigger_name name;
BEGIN
  FOR trigger_name IN SELECT tgname FROM _passed_state_reenable LOOP
    EXECUTE format('ALTER TABLE public.deals DISABLE TRIGGER %I', trigger_name);
  END LOOP;
END $$;

INSERT INTO private.passed_stage_restore (deal_id, previous_stage)
SELECT id, deal_stage
FROM public.deals
WHERE deal_stage = 'Passed'
ON CONFLICT (deal_id) DO NOTHING;

UPDATE public.deals
SET
  is_passed = true,
  passed_at = COALESCE(passed_at, entry_date::timestamptz, created_at),
  passed_reason = COALESCE(passed_reason, pass_reason)
WHERE tier = 'passed'::public.deal_tier
   OR passed = true
   OR deal_stage = 'Passed';

-- Stage evidence, in the same order as the original backfill, excluding the
-- 'Passed' bucket. Deals with no dd/nbo evidence become Screening/Pipeline.
UPDATE public.deals
SET deal_stage = CASE
  WHEN dd THEN 'Due Diligence'
  WHEN nbo THEN 'NBIO / Term Sheet'
  ELSE 'Screening/Pipeline'
END
WHERE deal_stage = 'Passed';

INSERT INTO public.deal_stage_history (deal_id, field, from_value, to_value, changed_at, note)
SELECT
  restored.deal_id,
  'stage',
  restored.previous_stage,
  deal.deal_stage,
  now(),
  'Passed is now separate from stage'
FROM private.passed_stage_restore AS restored
JOIN public.deals AS deal ON deal.id = restored.deal_id
WHERE deal.deal_stage IS DISTINCT FROM restored.previous_stage
  AND NOT EXISTS (
    SELECT 1
    FROM public.deal_stage_history AS history
    WHERE history.deal_id = restored.deal_id
      AND history.note = 'Passed is now separate from stage'
  );

DO $$
DECLARE
  trigger_name name;
BEGIN
  FOR trigger_name IN SELECT tgname FROM _passed_state_reenable LOOP
    EXECUTE format('ALTER TABLE public.deals ENABLE TRIGGER %I', trigger_name);
  END LOOP;
END $$;

DROP TABLE _passed_state_reenable;
