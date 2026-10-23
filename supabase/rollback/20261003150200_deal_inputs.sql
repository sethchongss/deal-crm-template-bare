-- Rolls back 20261003150200_deal_inputs.sql.

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_stake_percent_check;
ALTER TABLE public.deals DROP COLUMN IF EXISTS vendor;
ALTER TABLE public.deals DROP COLUMN IF EXISTS ticket_size;
ALTER TABLE public.deals DROP COLUMN IF EXISTS stake_percent;
ALTER TABLE public.deals DROP COLUMN IF EXISTS transaction_type;
ALTER TABLE public.deals DROP COLUMN IF EXISTS enterprise_value;
ALTER TABLE public.deals DROP COLUMN IF EXISTS financial_year;
ALTER TABLE public.deals DROP COLUMN IF EXISTS legal_name;
