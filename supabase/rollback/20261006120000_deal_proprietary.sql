-- Reverse 20261006120000_deal_proprietary.sql.
-- Drops is_proprietary. Restores the previous parse_financial body.
-- Does not rewrite deal financial text or other columns.

ALTER TABLE public.deals DROP COLUMN IF EXISTS is_proprietary;

CREATE OR REPLACE FUNCTION public.parse_financial(raw text)
RETURNS TABLE(amount numeric, currency text, assumed boolean)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
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
