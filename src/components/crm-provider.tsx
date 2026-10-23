"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { prepareDealPatch } from "@/lib/deal-patch";
import type { ImportWrite } from "@/lib/import-deals";
import { passedFlagsAfterTierMove, topSortOrderForBoard, type KanbanOrderUpdate } from "@/lib/kanban-order";
import type { Deal, DealPartner, DealTier, Partner } from "@/types/database";

function messageOf(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

export type ClaudeMark = {
  id: string;
  table_name: string;
  row_id: string | null;
  action: string;
  created_at: string;
  actor_label: string | null;
};

type CrmContextValue = {
  deals: Deal[];
  partners: Partner[];
  links: DealPartner[];
  claudeMarks: ClaudeMark[];
  loading: boolean;
  error: string | null;
  toast: string | null;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
  undoClaudeChange: (auditId: string) => Promise<boolean>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<boolean>;
  reorderDeals: (updates: KanbanOrderUpdate[]) => Promise<boolean>;
  createDeal: (deal: Partial<Deal> & { company_name: string }) => Promise<Deal | null>;
  applyImport: (writes: ImportWrite[]) => Promise<string | null>;
  deleteDeal: (id: string) => Promise<boolean>;
  archiveDeal: (id: string) => Promise<boolean>;
  unarchiveDeal: (id: string) => Promise<boolean>;
  createPartner: (partner: Partial<Partner> & { name: string; role: Partner["role"] }) => Promise<boolean>;
  updatePartner: (id: string, updates: Partial<Partner>) => Promise<boolean>;
  deletePartner: (id: string) => Promise<boolean>;
  refreshLinks: () => Promise<void>;
};

const CrmContext = createContext<CrmContextValue | null>(null);

function normalizeDeal(row: Deal): Deal {
  return {
    ...row,
    archived: row.archived ?? false,
    fin_currency_assumed: row.fin_currency_assumed ?? false,
    is_passed: row.is_passed ?? row.tier === "passed",
    is_proprietary: row.is_proprietary ?? false,
    industry: row.industry ?? null,
  };
}

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [links, setLinks] = useState<DealPartner[]>([]);
  const [claudeMarks, setClaudeMarks] = useState<ClaudeMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2200);
  }, []);

  const refreshLinks = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from("deal_partners").select("*");
    if (fetchError) {
      setError(messageOf(fetchError, "Couldn't load linked partners."));
      return;
    }
    setLinks(data || []);
  }, []);

  const refresh = useCallback(async () => {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [dealResult, partnerResult, linkResult, markResult] = await Promise.all([
      supabase.from("deals").select("*").order("sort_order", { ascending: true }),
      supabase.from("partners").select("*").order("name", { ascending: true }),
      supabase.from("deal_partners").select("*"),
      supabase
        .from("audit_log")
        .select("id, table_name, row_id, action, created_at, actor_label")
        .eq("source", "claude")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (dealResult.error || partnerResult.error || linkResult.error) {
      setError(messageOf(dealResult.error || partnerResult.error || linkResult.error, "Couldn't load the pipeline."));
    } else {
      setError(null);
      setDeals((dealResult.data || []).map((row) => normalizeDeal(row as Deal)));
      setPartners(partnerResult.data || []);
      setLinks(linkResult.data || []);
      setClaudeMarks(markResult.error ? [] : ((markResult.data || []) as ClaudeMark[]));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const updateDeal = useCallback(async (id: string, updates: Partial<Deal>) => {
    const current = deals.find((deal) => deal.id === id);
    const patch = prepareDealPatch(updates, current);
    const { error: updateError } = await supabase.from("deals").update(patch).eq("id", id);
    if (updateError) {
      setError(messageOf(updateError, "Couldn't save this deal."));
      return false;
    }
    setError(null);
    setDeals((prev) => prev.map((deal) => (deal.id === id ? normalizeDeal({ ...deal, ...patch }) : deal)));
    return true;
  }, [deals]);

  const reorderDeals = useCallback(async (updates: KanbanOrderUpdate[]) => {
    if (updates.length === 0) return true;
    const previous = deals;
    const patches = updates.map((update) => {
      const deal = previous.find((item) => item.id === update.id);
      const patch: Partial<Deal> & { tier: DealTier; sort_order: number } = {
        tier: update.tier as DealTier,
        sort_order: update.sort_order,
      };
      if (deal) {
        const passedChange = passedFlagsAfterTierMove(deal.tier, update.tier as DealTier);
        if (passedChange === "set") {
          patch.is_passed = true;
          patch.passed = true;
          patch.passed_at = deal.passed_at ?? new Date().toISOString();
        } else if (passedChange === "clear") {
          patch.is_passed = false;
          patch.passed = false;
          patch.passed_at = null;
        }
      }
      return { id: update.id, patch };
    });
    setDeals((prev) =>
      prev.map((deal) => {
        const next = patches.find((item) => item.id === deal.id);
        return next ? { ...deal, ...next.patch } : deal;
      }),
    );
    const results = await Promise.all(
      patches.map(({ id, patch }) => supabase.from("deals").update(patch).eq("id", id)),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setDeals(previous);
      setError(messageOf(failed.error, "Couldn't move this deal."));
      return false;
    }
    setError(null);
    return true;
  }, [deals]);

  const createDeal = useCallback(async (deal: Partial<Deal> & { company_name: string }) => {
    const tier = deal.tier ?? "pipeline";
    const nextOrder = topSortOrderForBoard(deals, tier);
    const patch = prepareDealPatch({ ...deal, tier, sort_order: deal.sort_order ?? nextOrder });
    const { data, error: createError } = await supabase.from("deals").insert(patch).select().single();
    if (createError || !data) {
      setError(messageOf(createError, "Couldn't create this deal."));
      return null;
    }
    setError(null);
    const created = normalizeDeal(data as Deal);
    setDeals((prev) => [...prev, created]);
    return created;
  }, [deals]);

  const deleteDeal = useCallback(async (id: string) => {
    const previous = deals;
    setDeals((prev) => prev.filter((deal) => deal.id !== id));
    const { error: deleteError } = await supabase.from("deals").delete().eq("id", id);
    if (deleteError) {
      setDeals(previous);
      setError(messageOf(deleteError, "Couldn't delete this deal."));
      return false;
    }
    setLinks((prev) => prev.filter((link) => link.deal_id !== id));
    setError(null);
    return true;
  }, [deals]);

  const undoClaudeChange = useCallback(async (auditId: string) => {
    const { error: undoError } = await supabase.rpc("undo_claude_change", { p_id: auditId });
    if (undoError) {
      notify(undoError.message || "Couldn't undo that change.");
      return false;
    }
    notify("Change undone");
    await refresh();
    return true;
  }, [notify, refresh]);

  const applyImport = useCallback(async (writes: ImportWrite[]) => {
    for (const write of writes) {
      if (write.op === "delete") {
        const { error: deleteError } = await supabase.from("deals").delete().eq("id", write.id);
        if (deleteError) {
          await refresh();
          return deleteError.message || "Couldn't delete a deal from this import.";
        }
        continue;
      }
      if (write.op === "update") {
        const current = deals.find((deal) => deal.id === write.id);
        const patch = prepareDealPatch(write.patch, current);
        const { error: updateError } = await supabase.from("deals").update(patch).eq("id", write.id);
        if (updateError) {
          await refresh();
          return updateError.message || "Couldn't update a deal from this import.";
        }
        continue;
      }
      const patch = prepareDealPatch(write.patch);
      const { error: createError } = await supabase.from("deals").insert(patch);
      if (createError) {
        await refresh();
        return createError.message || "Couldn't create a deal from this import.";
      }
    }
    await refresh();
    return null;
  }, [deals, refresh]);

  const archiveDeal = useCallback((id: string) => updateDeal(id, { archived: true }), [updateDeal]);
  const unarchiveDeal = useCallback((id: string) => updateDeal(id, { archived: false }), [updateDeal]);

  const createPartner = useCallback(async (partner: Partial<Partner> & { name: string; role: Partner["role"] }) => {
    const { error: insertError } = await supabase.from("partners").insert(partner);
    if (insertError) {
      setError(messageOf(insertError, "Couldn't add this partner."));
      return false;
    }
    setError(null);
    await refresh();
    return true;
  }, [refresh]);

  const updatePartner = useCallback(async (id: string, updates: Partial<Partner>) => {
    const { error: updateError } = await supabase.from("partners").update(updates).eq("id", id);
    if (updateError) {
      setError(messageOf(updateError, "Couldn't save this partner."));
      return false;
    }
    setError(null);
    await refresh();
    return true;
  }, [refresh]);

  const deletePartner = useCallback(async (id: string) => {
    const previous = partners;
    setPartners((current) => current.filter((partner) => partner.id !== id));
    const { error: deleteError } = await supabase.from("partners").delete().eq("id", id);
    if (deleteError) {
      setPartners(previous);
      setError(messageOf(deleteError, "Couldn't delete this partner."));
      return false;
    }
    setError(null);
    await refresh();
    return true;
  }, [partners, refresh]);

  const value = useMemo<CrmContextValue>(() => ({
    deals, partners, links, claudeMarks, loading, error, toast, notify, refresh, undoClaudeChange, updateDeal, reorderDeals,
    createDeal, deleteDeal, applyImport, archiveDeal, unarchiveDeal, createPartner, updatePartner, deletePartner, refreshLinks,
  }), [
    deals, partners, links, claudeMarks, loading, error, toast, notify, refresh, undoClaudeChange, updateDeal, reorderDeals,
    createDeal, deleteDeal, applyImport, archiveDeal, unarchiveDeal, createPartner, updatePartner, deletePartner, refreshLinks,
  ]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const value = useContext(CrmContext);
  if (!value) throw new Error("useCrm must be used inside CrmProvider");
  return value;
}
