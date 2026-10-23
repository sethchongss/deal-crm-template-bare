-- Rolls back 20261003130100_deal_stage.sql
-- Drops the stage column, history table, and their triggers.
-- Does not modify tier or any other existing column.

DROP TRIGGER IF EXISTS deals_stage_history ON public.deals;
DROP TRIGGER IF EXISTS deals_default_stage ON public.deals;
DROP TRIGGER IF EXISTS deal_stage_history_audit ON public.deal_stage_history;

DROP POLICY IF EXISTS deal_stage_history_select ON public.deal_stage_history;

DROP TABLE IF EXISTS public.deal_stage_history;

DROP FUNCTION IF EXISTS private.log_deal_stage_history();
DROP FUNCTION IF EXISTS private.default_deal_stage();

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_deal_stage_check;
DROP INDEX IF EXISTS public.idx_deals_deal_stage;
ALTER TABLE public.deals DROP COLUMN IF EXISTS deal_stage;
