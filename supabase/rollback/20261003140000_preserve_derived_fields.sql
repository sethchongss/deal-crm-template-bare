-- Rolls back 20261003140000_preserve_derived_fields.sql.
-- Restores the always-overwrite derive function and the unlocked
-- parse_financial search_path. Derived values already stored are kept.

ALTER TABLE public.deal_tasks DROP CONSTRAINT IF EXISTS deal_tasks_workstream_deal_fkey;
ALTER TABLE public.deal_workstreams DROP CONSTRAINT IF EXISTS deal_workstreams_id_deal_key;

ALTER FUNCTION public.parse_financial(text) RESET search_path;
ALTER FUNCTION public.update_updated_at() RESET search_path;

CREATE OR REPLACE FUNCTION private.derive_deal_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group text;
  v_detail text;
  v_sales_amount numeric;
  v_sales_currency text;
  v_sales_assumed boolean;
  v_ebitda_amount numeric;
  v_ebitda_currency text;
  v_ebitda_assumed boolean;
  v_debt_amount numeric;
  v_debt_currency text;
  v_debt_assumed boolean;
  codes text[];
BEGIN
  IF NEW.sector IS NULL OR btrim(NEW.sector) = '' THEN
    NEW.sector_group := NULL;
    NEW.sector_detail := NULL;
  ELSE
    SELECT m.sector_group, m.sector_detail
    INTO v_group, v_detail
    FROM public.sector_group_map m
    WHERE m.source_sector = btrim(NEW.sector);
    IF NOT FOUND THEN
      NEW.sector_group := NULL;
      NEW.sector_detail := NULLIF(regexp_replace(btrim(NEW.sector), '\s+', ' ', 'g'), '');
    ELSE
      NEW.sector_group := v_group;
      NEW.sector_detail := v_detail;
    END IF;
  END IF;

  IF NEW.country IS NULL OR btrim(NEW.country) = '' THEN
    NEW.countries := NULL;
  ELSE
    SELECT array_agg(btrim(part) ORDER BY ord)
    INTO NEW.countries
    FROM unnest(string_to_array(NEW.country, '/')) WITH ORDINALITY AS u(part, ord)
    WHERE btrim(part) <> '';
  END IF;

  SELECT parsed.amount, parsed.currency, parsed.assumed
  INTO v_sales_amount, v_sales_currency, v_sales_assumed
  FROM public.parse_financial(NEW.latest_sales) AS parsed;

  SELECT parsed.amount, parsed.currency, parsed.assumed
  INTO v_ebitda_amount, v_ebitda_currency, v_ebitda_assumed
  FROM public.parse_financial(NEW.latest_ebitda) AS parsed;

  SELECT parsed.amount, parsed.currency, parsed.assumed
  INTO v_debt_amount, v_debt_currency, v_debt_assumed
  FROM public.parse_financial(NEW.net_debt_cash) AS parsed;

  NEW.sales_amount := v_sales_amount;
  NEW.ebitda_amount := v_ebitda_amount;
  NEW.net_debt_amount := v_debt_amount;

  SELECT array_agg(DISTINCT code)
  INTO codes
  FROM unnest(ARRAY[v_sales_currency, v_ebitda_currency, v_debt_currency]) AS code
  WHERE code IS NOT NULL;

  IF codes IS NULL OR cardinality(codes) <> 1 THEN
    NEW.fin_currency := NULL;
  ELSE
    NEW.fin_currency := codes[1];
  END IF;

  NEW.fin_currency_assumed :=
    (v_sales_amount IS NOT NULL AND v_sales_currency IS NULL)
    OR (v_ebitda_amount IS NOT NULL AND v_ebitda_currency IS NULL)
    OR (v_debt_amount IS NOT NULL AND v_debt_currency IS NULL);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.derive_deal_fields() FROM PUBLIC, anon, authenticated;
