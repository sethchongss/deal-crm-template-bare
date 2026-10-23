-- Rolls back 20261003150000_passed_state.sql.
-- Restores deal_stage for rows this migration changed. Other columns stay as they are.

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

UPDATE public.deals AS deal
SET deal_stage = restored.previous_stage
FROM private.passed_stage_restore AS restored
WHERE deal.id = restored.deal_id;

DELETE FROM public.deal_stage_history
WHERE note = 'Passed is now separate from stage';

DO $$
DECLARE
  trigger_name name;
BEGIN
  FOR trigger_name IN SELECT tgname FROM _passed_state_reenable LOOP
    EXECUTE format('ALTER TABLE public.deals ENABLE TRIGGER %I', trigger_name);
  END LOOP;
END $$;

DROP TABLE _passed_state_reenable;

DROP TABLE IF EXISTS private.passed_stage_restore;

ALTER TABLE public.deals DROP COLUMN IF EXISTS passed_reason;
ALTER TABLE public.deals DROP COLUMN IF EXISTS passed_at;
ALTER TABLE public.deals DROP COLUMN IF EXISTS is_passed;
