-- Wider labels for task status, partner type, and the role on a deal.
-- Existing values stay valid. Requires 20261003130400 and 20261003130500.

ALTER TABLE public.deal_tasks DROP CONSTRAINT IF EXISTS deal_tasks_status_check;
ALTER TABLE public.deal_tasks
  ADD CONSTRAINT deal_tasks_status_check CHECK (
    status IN ('not_started', 'in_motion', 'at_risk', 'done', 'blocked')
  );

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_role_check;
ALTER TABLE public.partners
  ADD CONSTRAINT partners_role_check CHECK (
    role = ANY (ARRAY['operators', 'co-investors', 'advisors', 'others', 'bankers', 'lawyers']::text[])
  );

ALTER TABLE public.deal_partners DROP CONSTRAINT IF EXISTS deal_partners_role_check;
ALTER TABLE public.deal_partners
  ADD CONSTRAINT deal_partners_role_check CHECK (
    role_on_deal IN ('source', 'advisor', 'co-investor', 'operator', 'other', 'lender', 'introducer')
  );
