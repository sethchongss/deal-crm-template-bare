"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { prepareDealPatch } from "@/lib/deal-patch";
import { passedFlagsAfterTierMove } from "@/lib/kanban-order";
import type { Deal, DealTier, DealActivity } from "@/types/database";

function messageOf(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("deals")
      .select("*")
      .order("sort_order", { ascending: true });
    if (fetchError) {
      console.error("Error fetching deals:", fetchError);
      setError(messageOf(fetchError, "Couldn't load deals."));
    } else {
      setError(null);
      setDeals((data || []).map((d) => ({ ...d, archived: d.archived ?? false })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchDeals(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDeals]);

  const updateDeal = async (id: string, updates: Partial<Deal>) => {
    const patch = prepareDealPatch(updates, deals.find((deal) => deal.id === id));
    const { error: updateError } = await supabase.from("deals").update(patch).eq("id", id);
    if (updateError) {
      console.error("Error updating deal:", updateError);
      setError(messageOf(updateError, "Couldn't save this deal."));
      return false;
    }
    setError(null);
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    return true;
  };

  const moveDeal = async (id: string, newTier: DealTier, newIndex: number) => {
    const previous = deals;
    const dealIdx = previous.findIndex((d) => d.id === id);
    if (dealIdx === -1) return false;
    const current = previous[dealIdx];
    const passedChange = passedFlagsAfterTierMove(current.tier, newTier);
    const patch: Partial<Deal> = { tier: newTier, sort_order: newIndex };
    if (passedChange === "set") {
      patch.is_passed = true;
      patch.passed = true;
      patch.passed_at = current.passed_at ?? new Date().toISOString();
    } else if (passedChange === "clear") {
      patch.is_passed = false;
      patch.passed = false;
      patch.passed_at = null;
    }

    const updated = [...previous];
    updated[dealIdx] = { ...current, ...patch };
    setDeals(updated);

    const { error: moveError } = await supabase
      .from("deals")
      .update(patch)
      .eq("id", id);
    if (moveError) {
      console.error("Error moving deal:", moveError);
      setDeals(previous);
      setError(messageOf(moveError, "Couldn't move this deal."));
      return false;
    }
    setError(null);
    return true;
  };

  const createDeal = async (deal: Partial<Deal> & { company_name: string }) => {
    const { data, error: createError } = await supabase.from("deals").insert(deal).select().single();
    if (createError) {
      console.error("Error creating deal:", createError);
      setError(messageOf(createError, "Couldn't create this deal."));
      return null;
    }
    setError(null);
    setDeals((prev) => [...prev, { ...data, archived: data.archived ?? false }]);
    return data;
  };

  const deleteDeal = async (id: string) => {
    const previous = deals;
    setDeals((prev) => prev.filter((d) => d.id !== id));
    const { error: deleteError } = await supabase.from("deals").delete().eq("id", id);
    if (deleteError) {
      console.error("Error deleting deal:", deleteError);
      setDeals(previous);
      setError(messageOf(deleteError, "Couldn't delete this deal."));
      return false;
    }
    setError(null);
    return true;
  };

  const archiveDeal = async (id: string) => updateDeal(id, { archived: true });
  const unarchiveDeal = async (id: string) => updateDeal(id, { archived: false });

  return {
    deals,
    loading,
    error,
    fetchDeals,
    updateDeal,
    moveDeal,
    createDeal,
    deleteDeal,
    archiveDeal,
    unarchiveDeal,
  };
}

export function useDealActivities(dealId: string | null) {
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fetchGen = useRef(0);

  const fetchActivities = useCallback(async () => {
    if (!dealId) {
      setActivities([]);
      return;
    }
    const gen = ++fetchGen.current;

    const { data, error: fetchError } = await supabase
      .from("deal_activities")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    if (gen !== fetchGen.current) return;
    if (fetchError) {
      console.error("Error fetching activities:", fetchError);
      setError(messageOf(fetchError, "Couldn't load notes."));
      return;
    }

    setError(null);
    setActivities(data || []);
  }, [dealId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchActivities(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchActivities]);

  const addActivity = async (content: string) => {
    if (!dealId) return null;
    fetchGen.current += 1;
    const optimisticId = `pending-${Date.now()}`;
    const optimistic: DealActivity = {
      id: optimisticId,
      deal_id: dealId,
      content,
      created_at: new Date().toISOString(),
    };
    setActivities((current) => [optimistic, ...current]);
    const { data, error: insertError } = await supabase
      .from("deal_activities")
      .insert({ deal_id: dealId, content })
      .select()
      .single();
    if (insertError || !data) {
      console.error("Error adding activity:", insertError);
      setActivities((current) => current.filter((item) => item.id !== optimisticId));
      setError(messageOf(insertError, "Couldn't add this note."));
      return null;
    }
    setError(null);
    setActivities((current) => current.map((item) => (item.id === optimisticId ? data : item)));
    return data;
  };

  const updateActivity = async (id: string, content: string) => {
    const next = content.trim();
    if (!next) {
      setError("Write something before saving the note.");
      return null;
    }
    const previous = activities.find((item) => item.id === id);
    if (!previous || previous.id.startsWith("pending-")) return null;
    if (previous.content === next) return previous;
    setActivities((current) => current.map((item) => (item.id === id ? { ...item, content: next } : item)));
    const { data, error: updateError } = await supabase
      .from("deal_activities")
      .update({ content: next })
      .eq("id", id)
      .select()
      .single();
    if (updateError || !data) {
      console.error("Error updating activity:", updateError);
      setActivities((current) => current.map((item) => (item.id === id ? previous : item)));
      setError(messageOf(updateError, "Couldn't save this note."));
      return null;
    }
    setError(null);
    setActivities((current) => current.map((item) => (item.id === id ? data : item)));
    return data;
  };

  const deleteActivity = async (id: string) => {
    const previous = activities;
    const target = previous.find((item) => item.id === id);
    if (!target || target.id.startsWith("pending-")) return false;
    setActivities((current) => current.filter((item) => item.id !== id));
    const { data, error: deleteError } = await supabase.from("deal_activities").delete().eq("id", id).select("id");
    if (deleteError || !data?.length) {
      console.error("Error deleting activity:", deleteError);
      setActivities(previous);
      setError(messageOf(deleteError, "Couldn't delete this note."));
      return false;
    }
    setError(null);
    return true;
  };

  return { activities, error, addActivity, updateActivity, deleteActivity, fetchActivities };
}
