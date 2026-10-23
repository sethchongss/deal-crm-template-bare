-- Workstreams, tasks, and deal-level dates for the next-steps Gantt.
-- latest_context is unchanged. Requires 20261003120000_lockdown.sql.

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS target_completion_date date;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS exclusivity_end_date date;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS exclusivity_extension_date date;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS latest_update text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS latest_update_at timestamptz;

CREATE TABLE IF NOT EXISTS public.deal_workstreams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_workstreams_deal_idx
  ON public.deal_workstreams (deal_id, sort_order);

CREATE TABLE IF NOT EXISTS public.deal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstream_id uuid NOT NULL REFERENCES public.deal_workstreams (id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals (id) ON DELETE CASCADE,
  title text NOT NULL,
  owner text,
  start_date date,
  end_date date,
  is_milestone boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_started',
  comment text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_tasks_status_check CHECK (
    status IN ('not_started', 'in_motion', 'at_risk', 'done')
  )
);

CREATE INDEX IF NOT EXISTS deal_tasks_deal_idx ON public.deal_tasks (deal_id, sort_order);
CREATE INDEX IF NOT EXISTS deal_tasks_workstream_idx ON public.deal_tasks (workstream_id, sort_order);

ALTER TABLE public.deal_workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_workstreams_select ON public.deal_workstreams;
CREATE POLICY deal_workstreams_select ON public.deal_workstreams
  FOR SELECT TO authenticated USING ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_workstreams_insert ON public.deal_workstreams;
CREATE POLICY deal_workstreams_insert ON public.deal_workstreams
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_workstreams_update ON public.deal_workstreams;
CREATE POLICY deal_workstreams_update ON public.deal_workstreams
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_team()))
  WITH CHECK ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_workstreams_delete ON public.deal_workstreams;
CREATE POLICY deal_workstreams_delete ON public.deal_workstreams
  FOR DELETE TO authenticated USING ((SELECT private.is_team()));

DROP POLICY IF EXISTS deal_tasks_select ON public.deal_tasks;
CREATE POLICY deal_tasks_select ON public.deal_tasks
  FOR SELECT TO authenticated USING ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_tasks_insert ON public.deal_tasks;
CREATE POLICY deal_tasks_insert ON public.deal_tasks
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_tasks_update ON public.deal_tasks;
CREATE POLICY deal_tasks_update ON public.deal_tasks
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_team()))
  WITH CHECK ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_tasks_delete ON public.deal_tasks;
CREATE POLICY deal_tasks_delete ON public.deal_tasks
  FOR DELETE TO authenticated USING ((SELECT private.is_team()));

REVOKE ALL ON TABLE public.deal_workstreams FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.deal_tasks FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deal_workstreams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deal_tasks TO authenticated;

DROP TRIGGER IF EXISTS deal_workstreams_audit ON public.deal_workstreams;
CREATE TRIGGER deal_workstreams_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_workstreams
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();

DROP TRIGGER IF EXISTS deal_tasks_audit ON public.deal_tasks;
CREATE TRIGGER deal_tasks_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_tasks
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
