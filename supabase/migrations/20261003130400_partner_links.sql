-- Links partners to deals and starts a notes history.
-- Does not modify partners.relevant_deals or partners.notes.
-- Requires 20261003120000_lockdown.sql.
-- Live partners.role values are operators, co-investors, advisors, others.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partners'
      AND column_name = 'relevant_deals'
  ) THEN
    RAISE EXCEPTION 'partners.relevant_deals is missing; this migration targets the live partners table';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.deal_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals (id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners (id) ON DELETE CASCADE,
  role_on_deal text NOT NULL DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_partners_role_check CHECK (
    role_on_deal IN ('source', 'advisor', 'co-investor', 'operator', 'other')
  ),
  CONSTRAINT deal_partners_deal_partner_key UNIQUE (deal_id, partner_id)
);

CREATE INDEX IF NOT EXISTS deal_partners_partner_idx ON public.deal_partners (partner_id);

CREATE TABLE IF NOT EXISTS public.partner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners (id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_notes_partner_idx ON public.partner_notes (partner_id, created_at);

INSERT INTO public.deal_partners (deal_id, partner_id, role_on_deal)
SELECT
  d.id,
  p.id,
  CASE p.role
    WHEN 'advisors' THEN 'advisor'
    WHEN 'co-investors' THEN 'co-investor'
    WHEN 'operators' THEN 'operator'
    ELSE 'other'
  END
FROM public.partners p
CROSS JOIN LATERAL unnest(COALESCE(p.relevant_deals, ARRAY[]::uuid[])) AS rel(deal_id)
JOIN public.deals d ON d.id = rel.deal_id
ON CONFLICT (deal_id, partner_id) DO NOTHING;

INSERT INTO public.partner_notes (partner_id, content, created_at)
SELECT p.id, btrim(p.notes), COALESCE(p.created_at, now())
FROM public.partners p
WHERE p.notes IS NOT NULL
  AND btrim(p.notes) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.partner_notes n
    WHERE n.partner_id = p.id
      AND n.content = btrim(p.notes)
  );

ALTER TABLE public.deal_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_partners_select ON public.deal_partners;
CREATE POLICY deal_partners_select ON public.deal_partners
  FOR SELECT TO authenticated USING ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_partners_insert ON public.deal_partners;
CREATE POLICY deal_partners_insert ON public.deal_partners
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_partners_update ON public.deal_partners;
CREATE POLICY deal_partners_update ON public.deal_partners
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_team()))
  WITH CHECK ((SELECT private.is_team()));
DROP POLICY IF EXISTS deal_partners_delete ON public.deal_partners;
CREATE POLICY deal_partners_delete ON public.deal_partners
  FOR DELETE TO authenticated USING ((SELECT private.is_team()));

DROP POLICY IF EXISTS partner_notes_select ON public.partner_notes;
CREATE POLICY partner_notes_select ON public.partner_notes
  FOR SELECT TO authenticated USING ((SELECT private.is_team()));
DROP POLICY IF EXISTS partner_notes_insert ON public.partner_notes;
CREATE POLICY partner_notes_insert ON public.partner_notes
  FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_team()));
DROP POLICY IF EXISTS partner_notes_update ON public.partner_notes;
CREATE POLICY partner_notes_update ON public.partner_notes
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_team()))
  WITH CHECK ((SELECT private.is_team()));
DROP POLICY IF EXISTS partner_notes_delete ON public.partner_notes;
CREATE POLICY partner_notes_delete ON public.partner_notes
  FOR DELETE TO authenticated USING ((SELECT private.is_team()));

REVOKE ALL ON TABLE public.deal_partners FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.partner_notes FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deal_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partner_notes TO authenticated;

DROP TRIGGER IF EXISTS deal_partners_audit ON public.deal_partners;
CREATE TRIGGER deal_partners_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_partners
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();

DROP TRIGGER IF EXISTS partner_notes_audit ON public.partner_notes;
CREATE TRIGGER partner_notes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.partner_notes
  FOR EACH ROW EXECUTE FUNCTION private.audit_row();
