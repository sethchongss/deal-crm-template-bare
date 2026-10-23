-- Proprietary flag on deals, and a wider financial parser.
-- is_proprietary defaults to false. Existing row policies on public.deals already
-- cover the new column (they are row policies, not column grants). Table grants
-- are on the whole table, so authenticated keeps SELECT/INSERT/UPDATE/DELETE.
-- private.audit_row() stores to_jsonb(OLD/NEW), so the new column is audited
-- the same way as the other deal fields. No policy or trigger rewrite is required.
-- parse_financial is replaced in place. Existing deal rows are not rewritten.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_proprietary boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.deals.is_proprietary IS
  'True when the opportunity is proprietary. Distinct from source_type.';

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

  s := regexp_replace(s, '^(~+|≈+)\s*', '');
  s := regexp_replace(s, '^approx(\.|imately)?\s+', '', 'i');
  s := btrim(s);

  -- RMB before RM: RM is a prefix of RMB.
  IF s ~* '^US\$\s*' THEN code := 'USD'; s := regexp_replace(s, '^US\$\s*', '', 'i');
  ELSIF s ~* '^HK\$\s*' THEN code := 'HKD'; s := regexp_replace(s, '^HK\$\s*', '', 'i');
  ELSIF s ~* '^NZ\$\s*' THEN code := 'NZD'; s := regexp_replace(s, '^NZ\$\s*', '', 'i');
  ELSIF s ~* '^A\$\s*' THEN code := 'AUD'; s := regexp_replace(s, '^A\$\s*', '', 'i');
  ELSIF s ~* '^S\$\s*' THEN code := 'SGD'; s := regexp_replace(s, '^S\$\s*', '', 'i');
  ELSIF s ~* '^RMB\s*' THEN code := 'CNY'; s := regexp_replace(s, '^RMB\s*', '', 'i');
  ELSIF s ~* '^RM\s*' THEN code := 'MYR'; s := regexp_replace(s, '^RM\s*', '', 'i');
  ELSIF s ~* '^CNY\s*' THEN code := 'CNY'; s := regexp_replace(s, '^CNY\s*', '', 'i');
  ELSIF s ~* '^CNH\s*' THEN code := 'CNY'; s := regexp_replace(s, '^CNH\s*', '', 'i');
  ELSIF s ~* '^THB\s*' THEN code := 'THB'; s := regexp_replace(s, '^THB\s*', '', 'i');
  ELSIF s ~* '^VND\s*' THEN code := 'VND'; s := regexp_replace(s, '^VND\s*', '', 'i');
  ELSIF s ~* '^IDR\s*' THEN code := 'IDR'; s := regexp_replace(s, '^IDR\s*', '', 'i');
  ELSIF s ~* '^PHP\s*' THEN code := 'PHP'; s := regexp_replace(s, '^PHP\s*', '', 'i');
  ELSIF s ~* '^JPY\s*' THEN code := 'JPY'; s := regexp_replace(s, '^JPY\s*', '', 'i');
  ELSIF s ~* '^KRW\s*' THEN code := 'KRW'; s := regexp_replace(s, '^KRW\s*', '', 'i');
  ELSIF s ~* '^INR\s*' THEN code := 'INR'; s := regexp_replace(s, '^INR\s*', '', 'i');
  ELSIF s ~* '^TWD\s*' THEN code := 'TWD'; s := regexp_replace(s, '^TWD\s*', '', 'i');
  ELSIF s ~* '^SGD\s*' THEN code := 'SGD'; s := regexp_replace(s, '^SGD\s*', '', 'i');
  ELSIF s ~* '^USD\s*' THEN code := 'USD'; s := regexp_replace(s, '^USD\s*', '', 'i');
  ELSIF s ~* '^HKD\s*' THEN code := 'HKD'; s := regexp_replace(s, '^HKD\s*', '', 'i');
  ELSIF s ~* '^MYR\s*' THEN code := 'MYR'; s := regexp_replace(s, '^MYR\s*', '', 'i');
  ELSIF s ~* '^AUD\s*' THEN code := 'AUD'; s := regexp_replace(s, '^AUD\s*', '', 'i');
  ELSIF s ~* '^EUR\s*' THEN code := 'EUR'; s := regexp_replace(s, '^EUR\s*', '', 'i');
  ELSIF s ~* '^GBP\s*' THEN code := 'GBP'; s := regexp_replace(s, '^GBP\s*', '', 'i');
  ELSIF s ~* '^CAD\s*' THEN code := 'CAD'; s := regexp_replace(s, '^CAD\s*', '', 'i');
  ELSIF s ~* '^CHF\s*' THEN code := 'CHF'; s := regexp_replace(s, '^CHF\s*', '', 'i');
  ELSIF s ~ '^€\s*' THEN code := 'EUR'; s := regexp_replace(s, '^€\s*', '');
  ELSIF s ~ '^£\s*' THEN code := 'GBP'; s := regexp_replace(s, '^£\s*', '');
  END IF;

  s := regexp_replace(s, '^(~+|≈+)\s*', '');
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
