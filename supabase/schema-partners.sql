-- HISTORICAL. Do not re-run. Live partners columns and the role check differ from this file.
-- New changes belong in supabase/migrations/.

-- Partners Database Schema

CREATE TYPE partner_role AS ENUM ('advisors', 'operators', 'co_investors', 'bankers');

CREATE TABLE partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role partner_role NOT NULL DEFAULT 'advisors',
  title TEXT,
  company TEXT,
  description TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partners_role ON partners(role);
CREATE INDEX idx_partners_name ON partners(name);

CREATE TRIGGER partners_updated_at BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for partners" ON partners FOR ALL USING (true);
