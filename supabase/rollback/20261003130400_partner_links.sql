-- Rolls back 20261003130400_partner_links.sql
-- Drops the join table and notes history. partners.relevant_deals and partners.notes stay.

DROP TRIGGER IF EXISTS deal_partners_audit ON public.deal_partners;
DROP TRIGGER IF EXISTS partner_notes_audit ON public.partner_notes;

DROP POLICY IF EXISTS deal_partners_select ON public.deal_partners;
DROP POLICY IF EXISTS deal_partners_insert ON public.deal_partners;
DROP POLICY IF EXISTS deal_partners_update ON public.deal_partners;
DROP POLICY IF EXISTS deal_partners_delete ON public.deal_partners;
DROP POLICY IF EXISTS partner_notes_select ON public.partner_notes;
DROP POLICY IF EXISTS partner_notes_insert ON public.partner_notes;
DROP POLICY IF EXISTS partner_notes_update ON public.partner_notes;
DROP POLICY IF EXISTS partner_notes_delete ON public.partner_notes;

DROP TABLE IF EXISTS public.deal_partners;
DROP TABLE IF EXISTS public.partner_notes;
