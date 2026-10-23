-- Local stand-in for the live public schema on 3 Oct 2026, plus the roles
-- Stage 1 expects. Not a production migration. Do not run this on the live database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.sub', true), ''),
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text
);

DO $$ BEGIN
  CREATE TYPE public.deal_tier AS ENUM ('active_tier_1', 'active_tier_2', 'pipeline', 'passed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.realized_status AS ENUM ('closed', 'analysis', 'portfolio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  tier public.deal_tier NOT NULL DEFAULT 'pipeline',
  sort_order integer DEFAULT 0,
  source text,
  source_type text,
  source_contact text,
  sector text,
  country text,
  company_description text,
  latest_context text,
  owners text,
  other_info text,
  latest_sales text,
  latest_ebitda text,
  net_debt_cash text,
  financial_comments text,
  entry_date date,
  nbo boolean DEFAULT false,
  dd boolean DEFAULT false,
  passed boolean DEFAULT false,
  pass_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived boolean DEFAULT false,
  screening_pdf_url text,
  screening_score integer,
  screening_thesis text,
  screening_why_own text,
  screening_why_now text,
  screening_exit_story text,
  screening_missing_data text[],
  screening_next_steps text[],
  screening_raw_analysis text,
  screening_updated_at timestamptz,
  CONSTRAINT deals_screening_score_check CHECK (screening_score IS NULL OR (screening_score >= 0 AND screening_score <= 100))
);

CREATE TABLE IF NOT EXISTS public.deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals (id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.realized_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  status public.realized_status DEFAULT 'analysis',
  team_member text,
  source text,
  sector text,
  company_description text,
  description text,
  owners text,
  deal_type text,
  sales text,
  ebitda text,
  debt text,
  comments text,
  country text,
  entry_date date,
  pass_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  sector_focus text[],
  region_focus text,
  relevant_deals uuid[],
  notes text,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  job_title text,
  company text,
  description text DEFAULT '',
  linkedin text,
  last_contacted timestamptz,
  avatar_url text,
  tags text[] DEFAULT '{}',
  -- Same allow-list as supabase/migrations/20261003170000_partner_type_lender.sql.
  CONSTRAINT partners_role_check CHECK (role = ANY (ARRAY['operators', 'co-investors', 'advisors', 'others', 'bankers', 'lawyers', 'lenders']))
);

CREATE INDEX IF NOT EXISTS idx_deals_tier ON public.deals (tier);
CREATE INDEX IF NOT EXISTS idx_deals_sector ON public.deals (sector);
CREATE INDEX IF NOT EXISTS idx_deals_country ON public.deals (country);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON public.deal_activities (deal_id);
CREATE INDEX IF NOT EXISTS idx_realized_deals_status ON public.realized_deals (status);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_updated_at ON public.deals;
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS realized_deals_updated_at ON public.realized_deals;
CREATE TRIGGER realized_deals_updated_at
  BEFORE UPDATE ON public.realized_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realized_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.deals;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.deal_activities;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.realized_deals;
DROP POLICY IF EXISTS "Allow all operations on partners" ON public.partners;

CREATE POLICY "Allow all for authenticated" ON public.deals FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.deal_activities FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.realized_deals FOR ALL USING (true);
CREATE POLICY "Allow all operations on partners" ON public.partners FOR ALL USING (true);

GRANT ALL ON TABLE public.deals TO anon, authenticated;
GRANT ALL ON TABLE public.deal_activities TO anon, authenticated;
GRANT ALL ON TABLE public.realized_deals TO anon, authenticated;
GRANT ALL ON TABLE public.partners TO anon, authenticated;
