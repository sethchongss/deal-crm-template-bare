-- Rolls back 20261003130500_workstreams.sql
-- Drops workstreams, tasks, and the new deal date columns. latest_context stays.

DROP TRIGGER IF EXISTS deal_tasks_audit ON public.deal_tasks;
DROP TRIGGER IF EXISTS deal_workstreams_audit ON public.deal_workstreams;

DROP POLICY IF EXISTS deal_tasks_select ON public.deal_tasks;
DROP POLICY IF EXISTS deal_tasks_insert ON public.deal_tasks;
DROP POLICY IF EXISTS deal_tasks_update ON public.deal_tasks;
DROP POLICY IF EXISTS deal_tasks_delete ON public.deal_tasks;
DROP POLICY IF EXISTS deal_workstreams_select ON public.deal_workstreams;
DROP POLICY IF EXISTS deal_workstreams_insert ON public.deal_workstreams;
DROP POLICY IF EXISTS deal_workstreams_update ON public.deal_workstreams;
DROP POLICY IF EXISTS deal_workstreams_delete ON public.deal_workstreams;

DROP TABLE IF EXISTS public.deal_tasks;
DROP TABLE IF EXISTS public.deal_workstreams;

ALTER TABLE public.deals DROP COLUMN IF EXISTS target_completion_date;
ALTER TABLE public.deals DROP COLUMN IF EXISTS exclusivity_end_date;
ALTER TABLE public.deals DROP COLUMN IF EXISTS exclusivity_extension_date;
ALTER TABLE public.deals DROP COLUMN IF EXISTS latest_update;
ALTER TABLE public.deals DROP COLUMN IF EXISTS latest_update_at;
