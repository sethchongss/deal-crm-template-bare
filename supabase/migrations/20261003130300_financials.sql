-- Numeric financials parsed from the existing text columns.
-- latest_sales, latest_ebitda and net_debt_cash are not modified.
-- public.parse_financial mirrors src/lib/financials.ts.
-- Requires 20261003120000_lockdown.sql and 20261003130200_sector_country.sql
-- (the derive trigger also refreshes sector_group and countries on later edits).

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS sales_amount numeric;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS ebitda_amount numeric;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS net_debt_amount numeric;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS fin_currency text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS fin_currency_assumed boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_fin_currency_check' AND conrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_fin_currency_check
      CHECK (fin_currency IS NULL OR fin_currency ~ '^[A-Z]{3}$');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.parse_financial(raw text)
RETURNS TABLE(amount numeric, currency text, assumed boolean)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
  negative boolean := false;
  code text := NULL;
  num numeric;
  scale text;
BEGIN
  IF raw IS NULL THEN
    amount := NULL; currency := NULL; assumed := false; RETURN NEXT; RETURN;
  END IF;

  s := btrim(raw);
  IF s = '' OR s IN ('-', '—', '–') OR s ~* '^n\.?a\.?$' OR position('%' IN s) > 0 THEN
    amount := NULL; currency := NULL; assumed := false; RETURN NEXT; RETURN;
  END IF;

  IF s ~ '^\(.*\)$' THEN
    negative := true;
    s := btrim(substring(s FROM 2 FOR char_length(s) - 2));
  END IF;

  IF s ~* '^US\$\s*' THEN code := 'USD'; s := regexp_replace(s, '^US\$\s*', '', 'i');
  ELSIF s ~* '^HK\$\s*' THEN code := 'HKD'; s := regexp_replace(s, '^HK\$\s*', '', 'i');
  ELSIF s ~* '^NZ\$\s*' THEN code := 'NZD'; s := regexp_replace(s, '^NZ\$\s*', '', 'i');
  ELSIF s ~* '^A\$\s*' THEN code := 'AUD'; s := regexp_replace(s, '^A\$\s*', '', 'i');
  ELSIF s ~* '^S\$\s*' THEN code := 'SGD'; s := regexp_replace(s, '^S\$\s*', '', 'i');
  ELSIF s ~* '^RM\s*' THEN code := 'MYR'; s := regexp_replace(s, '^RM\s*', '', 'i');
  ELSIF s ~* '^VND\s*' THEN code := 'VND'; s := regexp_replace(s, '^VND\s*', '', 'i');
  ELSIF s ~* '^IDR\s*' THEN code := 'IDR'; s := regexp_replace(s, '^IDR\s*', '', 'i');
  ELSIF s ~* '^SGD\s*' THEN code := 'SGD'; s := regexp_replace(s, '^SGD\s*', '', 'i');
  ELSIF s ~* '^USD\s*' THEN code := 'USD'; s := regexp_replace(s, '^USD\s*', '', 'i');
  ELSIF s ~* '^HKD\s*' THEN code := 'HKD'; s := regexp_replace(s, '^HKD\s*', '', 'i');
  ELSIF s ~* '^MYR\s*' THEN code := 'MYR'; s := regexp_replace(s, '^MYR\s*', '', 'i');
  ELSIF s ~* '^AUD\s*' THEN code := 'AUD'; s := regexp_replace(s, '^AUD\s*', '', 'i');
  ELSIF s ~* '^EUR\s*' THEN code := 'EUR'; s := regexp_replace(s, '^EUR\s*', '', 'i');
  ELSIF s ~* '^GBP\s*' THEN code := 'GBP'; s := regexp_replace(s, '^GBP\s*', '', 'i');
  ELSIF s ~ '^€\s*' THEN code := 'EUR'; s := regexp_replace(s, '^€\s*', '');
  ELSIF s ~ '^£\s*' THEN code := 'GBP'; s := regexp_replace(s, '^£\s*', '');
  END IF;

  s := btrim(replace(s, ',', ''));
  IF s !~ '^[+-]?\s*\d+(\.\d+)?\s*[KMBkmb]?$' THEN
    amount := NULL; currency := NULL; assumed := false; RETURN NEXT; RETURN;
  END IF;

  IF left(s, 1) = '-' THEN
    negative := true;
  END IF;

  -- No parentheses: substring(text FROM pattern) returns the first capture if one exists.
  num := substring(s FROM '\d+\.?\d*')::numeric;
  scale := upper(substring(s FROM '[KMBkmb]$'));
  IF scale = 'K' THEN
    num := num / 1000;
  ELSIF scale = 'B' THEN
    num := num * 1000;
  END IF;
  IF negative THEN
    num := -abs(num);
  END IF;

  amount := num;
  currency := code;
  assumed := code IS NULL;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.parse_financial(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parse_financial(text) TO authenticated;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'deals_updated_at' AND tgrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals DISABLE TRIGGER deals_updated_at;
  END IF;
END $$;

UPDATE public.deals AS d
SET
  sales_amount = (SELECT amount FROM public.parse_financial(d.latest_sales)),
  ebitda_amount = (SELECT amount FROM public.parse_financial(d.latest_ebitda)),
  net_debt_amount = (SELECT amount FROM public.parse_financial(d.net_debt_cash)),
  fin_currency = (
    SELECT CASE WHEN count(DISTINCT currency) = 1 THEN min(currency) ELSE NULL END
    FROM (
      SELECT currency FROM public.parse_financial(d.latest_sales)
      UNION ALL
      SELECT currency FROM public.parse_financial(d.latest_ebitda)
      UNION ALL
      SELECT currency FROM public.parse_financial(d.net_debt_cash)
    ) parsed
    WHERE currency IS NOT NULL
  ),
  fin_currency_assumed = COALESCE((
    SELECT (amount IS NOT NULL AND currency IS NULL)
    FROM public.parse_financial(d.latest_sales)
  ), false)
  OR COALESCE((
    SELECT (amount IS NOT NULL AND currency IS NULL)
    FROM public.parse_financial(d.latest_ebitda)
  ), false)
  OR COALESCE((
    SELECT (amount IS NOT NULL AND currency IS NULL)
    FROM public.parse_financial(d.net_debt_cash)
  ), false);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'deals_updated_at' AND tgrelid = 'public.deals'::regclass AND tgenabled = 'D'
  ) THEN
    ALTER TABLE public.deals ENABLE TRIGGER deals_updated_at;
  END IF;
END $$;

DROP TRIGGER IF EXISTS deals_derive_fields ON public.deals;
CREATE TRIGGER deals_derive_fields
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION private.derive_deal_fields();
