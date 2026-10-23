-- Read-only checks for 20261003170000_partner_type_lender.sql.
-- Does not modify data. Run after the migration.
-- Expect role to stay text and NOT NULL, and the check to allow lenders
-- plus the previous values. The migration assigns no row to lenders.

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partners'
  AND column_name = 'role';

SELECT pg_get_constraintdef(oid) AS partners_role_check
FROM pg_constraint
WHERE conrelid = 'public.partners'::regclass
  AND conname = 'partners_role_check';

SELECT
  position('lenders' IN pg_get_constraintdef(oid)) > 0 AS allows_lenders,
  position('bankers' IN pg_get_constraintdef(oid)) > 0 AS still_allows_bankers,
  position('lawyers' IN pg_get_constraintdef(oid)) > 0 AS still_allows_lawyers
FROM pg_constraint
WHERE conrelid = 'public.partners'::regclass
  AND conname = 'partners_role_check';

SELECT NOT EXISTS (
  SELECT 1
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname = 'partner_role'
) AS no_partner_role_enum;

SELECT role, count(*) AS partners
FROM public.partners
GROUP BY role
ORDER BY role;
