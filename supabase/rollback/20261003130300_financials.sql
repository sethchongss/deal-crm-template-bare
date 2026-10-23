-- Rolls back 20261003130300_financials.sql
-- Drops parsed financial columns and the parser. Text columns stay as they are.

DROP TRIGGER IF EXISTS deals_derive_fields ON public.deals;
DROP FUNCTION IF EXISTS private.derive_deal_fields();
DROP FUNCTION IF EXISTS public.parse_financial(text);

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_fin_currency_check;
ALTER TABLE public.deals DROP COLUMN IF EXISTS sales_amount;
ALTER TABLE public.deals DROP COLUMN IF EXISTS ebitda_amount;
ALTER TABLE public.deals DROP COLUMN IF EXISTS net_debt_amount;
ALTER TABLE public.deals DROP COLUMN IF EXISTS fin_currency;
ALTER TABLE public.deals DROP COLUMN IF EXISTS fin_currency_assumed;
