-- Normalised sector group, sector detail, and countries.
-- Original sector and country columns are not modified.
-- The lookup pairs match src/lib/taxonomy.ts. Requires 20261003120000_lockdown.sql.
-- Backfill disables deals_updated_at so updated_at is preserved.

CREATE TABLE IF NOT EXISTS public.sector_group_map (
  source_sector text PRIMARY KEY,
  sector_group text NOT NULL,
  sector_detail text NOT NULL
);

INSERT INTO public.sector_group_map (source_sector, sector_group, sector_detail) VALUES
  ('Equipment Rental', 'Equipment Rental', 'Equipment Rental'),
  ('Healthcare', 'Healthcare', 'Healthcare'),
  ('Education', 'Education', 'Education'),
  ('Logistics', 'Logistics', 'Logistics'),
  ('Industrial Services', 'Industrial Services', 'Industrial Services'),
  ('Building & Facilities', 'Building & Facilities', 'Building & Facilities'),
  ('Food & Agri', 'Food & Agri', 'Food & Agri'),
  ('Fitness & Wellness', 'Fitness & Wellness', 'Fitness & Wellness'),
  ('Technology', 'Technology', 'Technology'),
  ('Distribution', 'Distribution', 'Distribution'),
  ('Energy', 'Energy', 'Energy'),
  ('Consumer', 'Consumer', 'Consumer'),
  ('Media & Entertainment', 'Media & Entertainment', 'Media & Entertainment'),
  ('Hospitality', 'Hospitality', 'Hospitality'),
  ('Security', 'Security', 'Security'),
  ('Chemicals & Materials', 'Chemicals & Materials', 'Chemicals & Materials'),
  ('Marine', 'Marine', 'Marine')
ON CONFLICT (source_sector) DO UPDATE
SET sector_group = EXCLUDED.sector_group,
    sector_detail = EXCLUDED.sector_detail;

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS sector_group text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS sector_detail text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS countries text[];

CREATE INDEX IF NOT EXISTS idx_deals_sector_group ON public.deals (sector_group);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'deals_updated_at' AND tgrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals DISABLE TRIGGER deals_updated_at;
  END IF;
END $$;

UPDATE public.deals d
SET
  sector_group = m.sector_group,
  sector_detail = m.sector_detail
FROM public.sector_group_map m
WHERE d.sector IS NOT NULL
  AND btrim(d.sector) = m.source_sector
  AND (d.sector_group IS DISTINCT FROM m.sector_group OR d.sector_detail IS DISTINCT FROM m.sector_detail);

UPDATE public.deals
SET sector_detail = NULLIF(regexp_replace(btrim(sector), '\s+', ' ', 'g'), '')
WHERE sector IS NOT NULL
  AND btrim(sector) <> ''
  AND sector_detail IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.sector_group_map m WHERE m.source_sector = btrim(deals.sector)
  );

UPDATE public.deals
SET countries = CASE
  WHEN country IS NULL OR btrim(country) = '' THEN NULL
  ELSE (
    SELECT array_agg(btrim(part) ORDER BY ord)
    FROM unnest(string_to_array(country, '/')) WITH ORDINALITY AS u(part, ord)
    WHERE btrim(part) <> ''
  )
END
WHERE countries IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'deals_updated_at' AND tgrelid = 'public.deals'::regclass AND tgenabled = 'D'
  ) THEN
    ALTER TABLE public.deals ENABLE TRIGGER deals_updated_at;
  END IF;
END $$;

ALTER TABLE public.sector_group_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sector_group_map_select ON public.sector_group_map;
CREATE POLICY sector_group_map_select ON public.sector_group_map
  FOR SELECT TO authenticated
  USING ((SELECT private.is_team()));

REVOKE ALL ON TABLE public.sector_group_map FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.sector_group_map TO authenticated;

DROP TRIGGER IF EXISTS sector_group_map_audit ON public.sector_group_map;
CREATE TRIGGER sector_group_map_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.sector_group_map
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_row();
