-- HISTORICAL. Do not re-run the commented storage policies; they are not restricted to members.
-- Screening storage access is set in supabase/migrations/.

-- Add screening intelligence columns to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_pdf_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_score INTEGER CHECK (screening_score >= 0 AND screening_score <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_thesis TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_why_own TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_why_now TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_exit_story TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_missing_data TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_next_steps TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_raw_analysis TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS screening_updated_at TIMESTAMPTZ;

-- Create storage bucket for screening documents (run this in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('screening-docs', 'screening-docs', false);

-- Storage policy for screening documents
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'screening-docs');
-- CREATE POLICY "Allow authenticated downloads" ON storage.objects FOR SELECT USING (bucket_id = 'screening-docs');