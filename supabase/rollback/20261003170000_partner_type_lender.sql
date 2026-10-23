-- Rolls back 20261003170000_partner_type_lender.sql.
-- The forward migration does not rewrite rows. This file only remaps a role
-- that was stored as lenders after that migration, so the previous check can be restored.

UPDATE public.partners SET role = 'others' WHERE role = 'lenders';

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_role_check;
ALTER TABLE public.partners
  ADD CONSTRAINT partners_role_check CHECK (
    role = ANY (ARRAY['operators', 'co-investors', 'advisors', 'others', 'bankers', 'lawyers']::text[])
  );
