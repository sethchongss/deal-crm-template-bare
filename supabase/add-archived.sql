-- HISTORICAL. The archived column is already on the live deals table. Do not treat this as a migration.
-- New changes belong in supabase/migrations/.

-- Add archived column to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_deals_archived ON deals(archived);
