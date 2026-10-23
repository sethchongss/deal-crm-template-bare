-- Fixed industry on deals. Schema only, no data backfill.
-- sector stays the freeform sub-sector. The check list matches src/lib/industries.ts.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS industry text;

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_industry_check;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_industry_check
  CHECK (
    industry IS NULL OR industry IN (
    'Agritech',
    'Air Transport',
    'Built Environment',
    'Business Services',
    'Electronics',
    'Energy & Chemicals',
    'Food Manufacturing',
    'Food Services',
    'Healthcare & Biomedical',
    'ICT & Media',
    'Land Transport',
    'Logistics',
    'Marine & Offshore Energy',
    'Precision Engineering',
    'Retail',
    'Sea Transport',
    'Urban Solutions',
    'Wholesale Trade',
    'Education',
    'Consumer & Lifestyle',
    'Hospitality & Tourism',
    'Financial Services & Real Estate'
    )
  );

COMMENT ON COLUMN public.deals.industry IS
  'Fixed industry. sector remains the freeform sub-sector.';
