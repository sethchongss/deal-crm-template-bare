-- Allow the partner type 'lenders' (shown as Lender).
-- Bank lending teams are a different type from bankers.
-- partners.role stays text NOT NULL. Existing rows are not rewritten.
-- There is no partner_role enum on the live database; the check is the allow-list.
-- Requires 20261003150100_task_and_link_labels.sql.

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_role_check;
ALTER TABLE public.partners
  ADD CONSTRAINT partners_role_check CHECK (
    role = ANY (ARRAY['operators', 'co-investors', 'advisors', 'others', 'bankers', 'lawyers', 'lenders']::text[])
  );
