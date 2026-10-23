-- Rolls back 20261003120000_lockdown.sql
-- Restores the previous open table policies and the original screening-docs storage policies.
-- Drops audit_log. Does not delete auth.users or deal data.
-- Drop policies that call private.is_team() before dropping that function.

DROP POLICY IF EXISTS deals_select ON public.deals;
DROP POLICY IF EXISTS deals_insert ON public.deals;
DROP POLICY IF EXISTS deals_update ON public.deals;
DROP POLICY IF EXISTS deals_delete ON public.deals;

DROP POLICY IF EXISTS deal_activities_select ON public.deal_activities;
DROP POLICY IF EXISTS deal_activities_insert ON public.deal_activities;
DROP POLICY IF EXISTS deal_activities_update ON public.deal_activities;
DROP POLICY IF EXISTS deal_activities_delete ON public.deal_activities;

DROP POLICY IF EXISTS realized_deals_select ON public.realized_deals;
DROP POLICY IF EXISTS realized_deals_insert ON public.realized_deals;
DROP POLICY IF EXISTS realized_deals_update ON public.realized_deals;
DROP POLICY IF EXISTS realized_deals_delete ON public.realized_deals;

DROP POLICY IF EXISTS partners_select ON public.partners;
DROP POLICY IF EXISTS partners_insert ON public.partners;
DROP POLICY IF EXISTS partners_update ON public.partners;
DROP POLICY IF EXISTS partners_delete ON public.partners;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;

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

DROP TRIGGER IF EXISTS deals_audit ON public.deals;
DROP TRIGGER IF EXISTS deal_activities_audit ON public.deal_activities;
DROP TRIGGER IF EXISTS realized_deals_audit ON public.realized_deals;
DROP TRIGGER IF EXISTS partners_audit ON public.partners;

DROP TABLE IF EXISTS public.audit_log;

DROP POLICY IF EXISTS screening_docs_select ON storage.objects;
DROP POLICY IF EXISTS screening_docs_insert ON storage.objects;
DROP POLICY IF EXISTS screening_docs_update ON storage.objects;
DROP POLICY IF EXISTS screening_docs_delete ON storage.objects;

DROP POLICY IF EXISTS "Allow authenticated downloads 1yeecoi_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads 1yeecoi_0" ON storage.objects;

CREATE POLICY "Allow authenticated downloads 1yeecoi_0"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'screening-docs');

CREATE POLICY "Allow authenticated uploads 1yeecoi_0"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'screening-docs');

DROP FUNCTION IF EXISTS public.keepalive();
DROP FUNCTION IF EXISTS private.keepalive();
DROP FUNCTION IF EXISTS private.audit_row();
DROP FUNCTION IF EXISTS private.is_team();
DROP TABLE IF EXISTS private.team_emails;

DROP SCHEMA IF EXISTS private;
