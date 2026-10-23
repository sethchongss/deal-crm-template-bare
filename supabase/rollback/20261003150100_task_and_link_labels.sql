-- Rolls back 20261003150100_task_and_link_labels.sql.
-- New label values are folded back onto the previous allowed values, then the checks shrink.

UPDATE public.deal_tasks SET status = 'at_risk' WHERE status = 'blocked';
UPDATE public.partners SET role = 'others' WHERE role IN ('bankers', 'lawyers');
UPDATE public.deal_partners SET role_on_deal = 'source' WHERE role_on_deal = 'introducer';
UPDATE public.deal_partners SET role_on_deal = 'other' WHERE role_on_deal = 'lender';

ALTER TABLE public.deal_tasks DROP CONSTRAINT IF EXISTS deal_tasks_status_check;
ALTER TABLE public.deal_tasks
  ADD CONSTRAINT deal_tasks_status_check CHECK (
    status IN ('not_started', 'in_motion', 'at_risk', 'done')
  );

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_role_check;
ALTER TABLE public.partners
  ADD CONSTRAINT partners_role_check CHECK (
    role = ANY (ARRAY['operators', 'co-investors', 'advisors', 'others']::text[])
  );

ALTER TABLE public.deal_partners DROP CONSTRAINT IF EXISTS deal_partners_role_check;
ALTER TABLE public.deal_partners
  ADD CONSTRAINT deal_partners_role_check CHECK (
    role_on_deal IN ('source', 'advisor', 'co-investor', 'operator', 'other')
  );
