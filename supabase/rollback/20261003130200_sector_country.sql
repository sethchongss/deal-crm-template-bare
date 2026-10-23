-- Rolls back 20261003130200_sector_country.sql
-- Drops the lookup table and the derived sector/country columns.
-- Does not modify deals.sector or deals.country.

DROP TRIGGER IF EXISTS sector_group_map_audit ON public.sector_group_map;
DROP POLICY IF EXISTS sector_group_map_select ON public.sector_group_map;
DROP TABLE IF EXISTS public.sector_group_map;

DROP INDEX IF EXISTS public.idx_deals_sector_group;
ALTER TABLE public.deals DROP COLUMN IF EXISTS sector_group;
ALTER TABLE public.deals DROP COLUMN IF EXISTS sector_detail;
ALTER TABLE public.deals DROP COLUMN IF EXISTS countries;
