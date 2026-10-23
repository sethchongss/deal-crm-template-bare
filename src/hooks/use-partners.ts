"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Partner } from "@/types/database";

function messageOf(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("partners")
      .select("*")
      .order("name", { ascending: true });

    if (fetchError) {
      console.error("Error fetching partners:", fetchError);
      setError(messageOf(fetchError, "Couldn't load partners."));
      setLoading(false);
      return;
    }
    setError(null);
    setPartners(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPartners(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPartners]);

  const createPartner = async (partner: Partial<Partner> & { name: string; role: Partner["role"] }) => {
    const { error: insertError } = await supabase.from("partners").insert(partner);
    if (insertError) {
      console.error("Error creating partner:", insertError);
      setError(messageOf(insertError, "Couldn't add this partner."));
      return false;
    }
    setError(null);
    await fetchPartners();
    return true;
  };

  const updatePartner = async (id: string, updates: Partial<Partner>) => {
    const { error: updateError } = await supabase.from("partners").update(updates).eq("id", id);
    if (updateError) {
      console.error("Error updating partner:", updateError);
      setError(messageOf(updateError, "Couldn't save this partner."));
      return false;
    }
    setError(null);
    await fetchPartners();
    return true;
  };

  const deletePartner = async (id: string) => {
    const previous = partners;
    setPartners((current) => current.filter((partner) => partner.id !== id));
    const { error: deleteError } = await supabase.from("partners").delete().eq("id", id);
    if (deleteError) {
      console.error("Error deleting partner:", deleteError);
      setPartners(previous);
      setError(messageOf(deleteError, "Couldn't delete this partner."));
      return false;
    }
    setError(null);
    await fetchPartners();
    return true;
  };

  return { partners, loading, error, fetchPartners, createPartner, updatePartner, deletePartner };
}
