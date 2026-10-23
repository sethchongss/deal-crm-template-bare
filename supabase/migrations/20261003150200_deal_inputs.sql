-- Extra deal inputs for the tracker form. All nullable. No existing values are rewritten.
-- Requires 20261003130300_financials.sql only in the sense that it follows it.

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS financial_year text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS enterprise_value text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS transaction_type text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS stake_percent numeric;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS ticket_size text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS vendor text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_stake_percent_check' AND conrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_stake_percent_check
      CHECK (stake_percent IS NULL OR (stake_percent >= 0 AND stake_percent <= 100));
  END IF;
END $$;
