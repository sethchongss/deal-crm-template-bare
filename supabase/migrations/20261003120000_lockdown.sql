-- Close the database to the public anon key.
-- One shared auth user is created separately, and its email is added to private.team_emails.
-- See docs/SETUP.md. No email address is hardcoded here.
-- This file does not insert that user and does not contain a password.
-- Idempotent. Does not modify or delete existing deal, activity, partner, or realized-deal rows.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Database side of the team allow-list. Keep it in step with TEAM_ALLOWED_EMAILS
-- (at minimum the first address, which is the shared login). Rows are added by the
-- setup SQL in docs/SETUP.md; this migration inserts none.
CREATE TABLE IF NOT EXISTS private.team_emails (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.team_emails FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.is_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN private.team_emails t ON t.email = lower(u.email)
    WHERE u.id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.is_team() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_team() TO authenticated;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  old_values jsonb,
  new_values jsonb,
  CONSTRAINT audit_log_action_check CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS audit_log_table_row_idx ON public.audit_log (table_name, row_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payload jsonb;
  row_pk uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := to_jsonb(OLD);
  ELSE
    payload := to_jsonb(NEW);
  END IF;

  BEGIN
    row_pk := NULLIF(payload->>'id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      row_pk := NULL;
  END;

  INSERT INTO public.audit_log (table_name, row_id, action, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    row_pk,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_row() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['deals', 'deal_activities', 'realized_deals', 'partners']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_audit', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.audit_row()',
      table_name || '_audit',
      table_name
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('deals', 'deal_activities', 'realized_deals', 'partners', 'audit_log')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realized_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- (select private.is_team()) is an initplan: Postgres evaluates it once per query.
CREATE POLICY deals_select ON public.deals
  FOR SELECT TO authenticated
  USING ((select private.is_team()));
CREATE POLICY deals_insert ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_team()));
CREATE POLICY deals_update ON public.deals
  FOR UPDATE TO authenticated
  USING ((select private.is_team()))
  WITH CHECK ((select private.is_team()));
CREATE POLICY deals_delete ON public.deals
  FOR DELETE TO authenticated
  USING ((select private.is_team()));

CREATE POLICY deal_activities_select ON public.deal_activities
  FOR SELECT TO authenticated
  USING ((select private.is_team()));
CREATE POLICY deal_activities_insert ON public.deal_activities
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_team()));
CREATE POLICY deal_activities_update ON public.deal_activities
  FOR UPDATE TO authenticated
  USING ((select private.is_team()))
  WITH CHECK ((select private.is_team()));
CREATE POLICY deal_activities_delete ON public.deal_activities
  FOR DELETE TO authenticated
  USING ((select private.is_team()));

CREATE POLICY realized_deals_select ON public.realized_deals
  FOR SELECT TO authenticated
  USING ((select private.is_team()));
CREATE POLICY realized_deals_insert ON public.realized_deals
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_team()));
CREATE POLICY realized_deals_update ON public.realized_deals
  FOR UPDATE TO authenticated
  USING ((select private.is_team()))
  WITH CHECK ((select private.is_team()));
CREATE POLICY realized_deals_delete ON public.realized_deals
  FOR DELETE TO authenticated
  USING ((select private.is_team()));

CREATE POLICY partners_select ON public.partners
  FOR SELECT TO authenticated
  USING ((select private.is_team()));
CREATE POLICY partners_insert ON public.partners
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_team()));
CREATE POLICY partners_update ON public.partners
  FOR UPDATE TO authenticated
  USING ((select private.is_team()))
  WITH CHECK ((select private.is_team()));
CREATE POLICY partners_delete ON public.partners
  FOR DELETE TO authenticated
  USING ((select private.is_team()));

CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING ((select private.is_team()));

-- Supabase default privileges include TRUNCATE for authenticated. Remove every
-- privilege first, then grant only what the app uses.
REVOKE ALL ON TABLE public.deals FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.deal_activities FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.realized_deals FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.partners FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.audit_log FROM anon, authenticated, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deal_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.realized_deals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partners TO authenticated;
GRANT SELECT ON TABLE public.audit_log TO authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        policyname ILIKE '%screening%'
        OR COALESCE(qual, '') ILIKE '%screening-docs%'
        OR COALESCE(with_check, '') ILIKE '%screening-docs%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY screening_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'screening-docs' AND (select private.is_team()));

CREATE POLICY screening_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'screening-docs' AND (select private.is_team()));

CREATE POLICY screening_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'screening-docs' AND (select private.is_team()))
  WITH CHECK (bucket_id = 'screening-docs' AND (select private.is_team()));

CREATE POLICY screening_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'screening-docs' AND (select private.is_team()));

CREATE OR REPLACE FUNCTION private.keepalive()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.deals LIMIT 1;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.keepalive() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.keepalive() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.keepalive();
$$;

REVOKE ALL ON FUNCTION public.keepalive() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.keepalive() TO anon, authenticated;

GRANT USAGE ON SCHEMA private TO anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION private.keepalive() TO service_role;
    GRANT EXECUTE ON FUNCTION public.keepalive() TO service_role;
  END IF;
END $$;
