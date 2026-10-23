-- HISTORICAL. Do not re-run. Live policies and the partners table have drifted.
-- New changes belong in supabase/migrations/. Re-running the policies below re-opens the database.

-- Deal Pipeline CRM Schema

-- Deals table (main pipeline)
CREATE TYPE deal_tier AS ENUM ('active_tier_1', 'active_tier_2', 'pipeline', 'passed');

CREATE TABLE deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  tier deal_tier NOT NULL DEFAULT 'pipeline',
  sort_order INTEGER DEFAULT 0,
  source TEXT,
  source_type TEXT,
  source_contact TEXT,
  sector TEXT,
  country TEXT,
  company_description TEXT,
  latest_context TEXT,
  owners TEXT,
  other_info TEXT,
  latest_sales TEXT,
  latest_ebitda TEXT,
  net_debt_cash TEXT,
  financial_comments TEXT,
  entry_date DATE,
  nbo BOOLEAN DEFAULT FALSE,
  dd BOOLEAN DEFAULT FALSE,
  passed BOOLEAN DEFAULT FALSE,
  pass_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log for deals
CREATE TABLE deal_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realized / Add-ons table
CREATE TYPE realized_status AS ENUM ('closed', 'analysis', 'portfolio');

CREATE TABLE realized_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  status realized_status DEFAULT 'analysis',
  team_member TEXT,
  source TEXT,
  sector TEXT,
  company_description TEXT,
  description TEXT,
  owners TEXT,
  deal_type TEXT,
  sales TEXT,
  ebitda TEXT,
  debt TEXT,
  comments TEXT,
  country TEXT,
  entry_date DATE,
  pass_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deals_tier ON deals(tier);
CREATE INDEX idx_deals_sector ON deals(sector);
CREATE INDEX idx_deals_country ON deals(country);
CREATE INDEX idx_deal_activities_deal_id ON deal_activities(deal_id);
CREATE INDEX idx_realized_deals_status ON realized_deals(status);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER realized_deals_updated_at BEFORE UPDATE ON realized_deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS policies (enable for production)
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE realized_deals ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (adjust for your needs)
CREATE POLICY "Allow all for authenticated" ON deals FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON deal_activities FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON realized_deals FOR ALL USING (true);
