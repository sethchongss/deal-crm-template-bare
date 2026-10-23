-- Stage milestone and history. Additive: new column, new table, triggers.
-- Does not change tier enum values or any existing column.
-- Requires supabase/migrations/20261003120000_lockdown.sql (private.is_team, private.audit_row).
-- Backfill disables deals_updated_at for the statement so updated_at is preserved.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_stage text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_deal_stage_check' AND conrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_deal_stage_check
      CHECK (
        deal_stage IS NULL OR deal_stage IN (
          'Screening/Pipeline',
          'NBIO / Term Sheet',
          'Due Diligence',
          'SPA / Signing',
          'Completed',
          'Passed'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deals_deal_stage ON public.deals (deal_stage);

CREATE OR REPLACE FUNCTION private.default_deal_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.deal_stage IS NULL THEN
    NEW.deal_stage := CASE
      WHEN NEW.dd IS TRUE THEN 'Due Diligence'
      WHEN NEW.nbo IS TRUE THEN 'NBIO / Term Sheet'
      WHEN NEW.tier::text = 'passed' OR NEW.passed IS TRUE THEN 'Passed'
      ELSE 'Screening/Pipeline'
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.default_deal_stage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS deals_default_stage ON public.deals;
CREATE TRIGGER deals_default_stage
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION private.default_deal_stage();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'deals_updated_at' AND tgrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals DISABLE TRIGGER deals_updated_at;
  END IF;
END $$;

UPDATE public.deals
SET deal_stage = CASE
  WHEN dd IS TRUE THEN 'Due Diligence'
  WHEN nbo IS TRUE THEN 'NBIO / Term Sheet'
  WHEN tier::text = 'passed' OR passed IS TRUE THEN 'Passed'
  ELSE 'Screening/Pipeline'
END
WHERE deal_stage IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'deals_updated_at' AND tgrelid = 'public.deals'::regclass AND tgenabled = 'D'
  ) THEN
    ALTER TABLE public.deals ENABLE TRIGGER deals_updated_at;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals (id) ON DELETE CASCADE,
  field text NOT NULL,
  from_value text,
  to_value text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text,
  CONSTRAINT deal_stage_history_field_check CHECK (field IN ('tier', 'stage'))
);

CREATE INDEX IF NOT EXISTS deal_stage_history_deal_idx
  ON public.deal_stage_history (deal_id, changed_at);

INSERT INTO public.deal_stage_history (deal_id, field, from_value, to_value, changed_at, note)
SELECT
  d.id,
  'stage',
  NULL,
  d.deal_stage,
  COALESCE(d.entry_date::timestamptz, d.created_at, now()),
  'Initial stage'
FROM public.deals d
WHERE d.deal_stage IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.deal_stage_history h
    WHERE h.deal_id = d.id
      AND h.field = 'stage'
      AND h.note = 'Initial stage'
  );

CREATE OR REPLACE FUNCTION private.log_deal_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deal_stage IS NOT NULL THEN
      INSERT INTO public.deal_stage_history (deal_id, field, from_value, to_value, changed_at, note)
      VALUES (
        NEW.id,
        'stage',
        NULL,
        NEW.deal_stage,
        COALESCE(NEW.entry_date::timestamptz, NEW.created_at, now()),
        'Initial stage'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    INSERT INTO public.deal_stage_history (deal_id, field, from_value, to_value, changed_at)
    VALUES (NEW.id, 'tier', OLD.tier::text, NEW.tier::text, now());
  END IF;

  IF NEW.deal_stage IS DISTINCT FROM OLD.deal_stage THEN
    INSERT INTO public.deal_stage_history (deal_id, field, from_value, to_value, changed_at)
    VALUES (NEW.id, 'stage', OLD.deal_stage, NEW.deal_stage, now());
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.log_deal_stage_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS deals_stage_history ON public.deals;
CREATE TRIGGER deals_stage_history
  AFTER INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION private.log_deal_stage_history();

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_stage_history_select ON public.deal_stage_history;
CREATE POLICY deal_stage_history_select ON public.deal_stage_history
  FOR SELECT TO authenticated
  USING ((SELECT private.is_team()));

REVOKE ALL ON TABLE public.deal_stage_history FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.deal_stage_history TO authenticated;

DROP TRIGGER IF EXISTS deal_stage_history_audit ON public.deal_stage_history;
CREATE TRIGGER deal_stage_history_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_stage_history
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_row();
