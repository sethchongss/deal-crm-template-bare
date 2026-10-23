-- Keep explicit edits of derived deal columns.
-- deals_derive_fields still runs on every update, but each derived column is
-- rewritten only when its source text changed or the derived value is null.
-- Also locks public.parse_financial's search_path, and requires a task's
-- deal_id to match its workstream.
-- Does not edit the already-applied Stage 2 migrations.
-- Requires 20261003130300_financials.sql and 20261003130500_workstreams.sql.

ALTER FUNCTION public.parse_financial(text) SET search_path = '';

-- public.update_updated_at is the other non-extension function the advisor
-- flags. now() is in pg_catalog, so an empty search_path is safe.
ALTER FUNCTION public.update_updated_at() SET search_path = '';

CREATE OR REPLACE FUNCTION private.derive_deal_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sector_changed boolean;
  country_changed boolean;
  sales_changed boolean;
  ebitda_changed boolean;
  debt_changed boolean;
  fill_group boolean;
  fill_detail boolean;
  filled_null_amount boolean := false;
  v_group text;
  v_detail text;
  v_sales_amount numeric;
  v_sales_currency text;
  v_ebitda_amount numeric;
  v_ebitda_currency text;
  v_debt_amount numeric;
  v_debt_currency text;
  codes text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    sector_changed := NEW.sector IS DISTINCT FROM OLD.sector;
    country_changed := NEW.country IS DISTINCT FROM OLD.country;
    sales_changed := NEW.latest_sales IS DISTINCT FROM OLD.latest_sales;
    ebitda_changed := NEW.latest_ebitda IS DISTINCT FROM OLD.latest_ebitda;
    debt_changed := NEW.net_debt_cash IS DISTINCT FROM OLD.net_debt_cash;
  ELSE
    sector_changed := true;
    country_changed := true;
    sales_changed := true;
    ebitda_changed := true;
    debt_changed := true;
  END IF;
  fill_group := sector_changed OR NEW.sector_group IS NULL;
  fill_detail := sector_changed OR NEW.sector_detail IS NULL;

  IF fill_group OR fill_detail THEN
    IF NEW.sector IS NULL OR btrim(NEW.sector) = '' THEN
      v_group := NULL;
      v_detail := NULL;
    ELSE
      SELECT m.sector_group, m.sector_detail
      INTO v_group, v_detail
      FROM public.sector_group_map m
      WHERE m.source_sector = btrim(NEW.sector);
      IF NOT FOUND THEN
        v_group := NULL;
        v_detail := NULLIF(regexp_replace(btrim(NEW.sector), '\s+', ' ', 'g'), '');
      END IF;
    END IF;
    IF fill_group THEN
      NEW.sector_group := v_group;
    END IF;
    IF fill_detail THEN
      NEW.sector_detail := v_detail;
    END IF;
  END IF;

  IF country_changed OR NEW.countries IS NULL THEN
    IF NEW.country IS NULL OR btrim(NEW.country) = '' THEN
      NEW.countries := NULL;
    ELSE
      SELECT array_agg(btrim(part) ORDER BY ord)
      INTO NEW.countries
      FROM unnest(string_to_array(NEW.country, '/')) WITH ORDINALITY AS u(part, ord)
      WHERE btrim(part) <> '';
    END IF;
  END IF;

  SELECT parsed.amount, parsed.currency
  INTO v_sales_amount, v_sales_currency
  FROM public.parse_financial(NEW.latest_sales) AS parsed;

  SELECT parsed.amount, parsed.currency
  INTO v_ebitda_amount, v_ebitda_currency
  FROM public.parse_financial(NEW.latest_ebitda) AS parsed;

  SELECT parsed.amount, parsed.currency
  INTO v_debt_amount, v_debt_currency
  FROM public.parse_financial(NEW.net_debt_cash) AS parsed;

  IF sales_changed OR NEW.sales_amount IS NULL THEN
    IF TG_OP = 'UPDATE' AND NOT sales_changed AND NEW.sales_amount IS NULL AND v_sales_amount IS NOT NULL THEN
      filled_null_amount := true;
    END IF;
    NEW.sales_amount := v_sales_amount;
  END IF;

  IF ebitda_changed OR NEW.ebitda_amount IS NULL THEN
    IF TG_OP = 'UPDATE' AND NOT ebitda_changed AND NEW.ebitda_amount IS NULL AND v_ebitda_amount IS NOT NULL THEN
      filled_null_amount := true;
    END IF;
    NEW.ebitda_amount := v_ebitda_amount;
  END IF;

  IF debt_changed OR NEW.net_debt_amount IS NULL THEN
    IF TG_OP = 'UPDATE' AND NOT debt_changed AND NEW.net_debt_amount IS NULL AND v_debt_amount IS NOT NULL THEN
      filled_null_amount := true;
    END IF;
    NEW.net_debt_amount := v_debt_amount;
  END IF;

  IF sales_changed OR ebitda_changed OR debt_changed OR filled_null_amount OR NEW.fin_currency IS NULL THEN
    SELECT array_agg(DISTINCT code)
    INTO codes
    FROM unnest(ARRAY[v_sales_currency, v_ebitda_currency, v_debt_currency]) AS code
    WHERE code IS NOT NULL;

    IF codes IS NULL OR cardinality(codes) <> 1 THEN
      NEW.fin_currency := NULL;
    ELSE
      NEW.fin_currency := codes[1];
    END IF;
  END IF;

  -- fin_currency_assumed is NOT NULL, so an explicit false must survive an
  -- unrelated update. Recompute it when the text changed or a null amount was filled.
  IF sales_changed OR ebitda_changed OR debt_changed OR filled_null_amount THEN
    NEW.fin_currency_assumed :=
      (v_sales_amount IS NOT NULL AND v_sales_currency IS NULL)
      OR (v_ebitda_amount IS NOT NULL AND v_ebitda_currency IS NULL)
      OR (v_debt_amount IS NOT NULL AND v_debt_currency IS NULL);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.derive_deal_fields() FROM PUBLIC, anon, authenticated;

-- The other functions added in Stage 1 and Stage 2 already set search_path.
-- parse_financial's body uses only pg_catalog functions, which stay visible
-- when search_path is empty.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.deal_tasks t
    JOIN public.deal_workstreams w ON w.id = t.workstream_id
    WHERE t.deal_id IS DISTINCT FROM w.deal_id
  ) THEN
    RAISE EXCEPTION 'deal_tasks.deal_id does not match its workstream';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_workstreams_id_deal_key'
      AND conrelid = 'public.deal_workstreams'::regclass
  ) THEN
    ALTER TABLE public.deal_workstreams
      ADD CONSTRAINT deal_workstreams_id_deal_key UNIQUE (id, deal_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_tasks_workstream_deal_fkey'
      AND conrelid = 'public.deal_tasks'::regclass
  ) THEN
    ALTER TABLE public.deal_tasks
      ADD CONSTRAINT deal_tasks_workstream_deal_fkey
      FOREIGN KEY (workstream_id, deal_id)
      REFERENCES public.deal_workstreams (id, deal_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END $$;
