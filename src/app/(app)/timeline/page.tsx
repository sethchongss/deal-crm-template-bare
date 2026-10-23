"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { SlidersHorizontal } from "lucide-react";
import { openDealQuery } from "@/components/app-shell";
import { useCrm } from "@/components/crm-provider";
import { ProprietaryFilter } from "@/components/proprietary-filter";
import { IndustryChip } from "@/components/industry-chip";
import { Tag } from "@/components/tag";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TIER_CONFIG, TIER_ORDER } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { INDUSTRIES } from "@/lib/industries";
import { displayStage, stageTone } from "@/lib/passed";
import { matchesProprietary, type ProprietaryFilterValue } from "@/lib/proprietary";
import { supabase } from "@/lib/supabase";
import type { Deal, DealStage, DealStageHistory, DealTier } from "@/types/database";
import { DEAL_STAGES } from "@/types/database";

type TimelineItem = {
  id: string;
  date: string;
  deal: Deal;
  kind: "entry" | "history";
  label: string;
  detail: string;
};

function monthKey(value: string) {
  const date = parseISO(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "Undated";
  return format(date, "MMMM yyyy");
}

export default function TimelinePage() {
  const { deals, partners, links, loading, error } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [history, setHistory] = useState<DealStageHistory[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [tier, setTier] = useState<DealTier | "">("");
  const [stage, setStage] = useState<DealStage | "">("");
  const [sector, setSector] = useState("");
  const [partner, setPartner] = useState("");
  const [proprietary, setProprietary] = useState<ProprietaryFilterValue>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from("deal_stage_history").select("*").order("changed_at", { ascending: false }).then(({ data, error: fetchError }) => {
      if (cancelled) return;
      if (fetchError) setHistoryError(fetchError.message);
      else setHistory(data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [deals.length]);

  const items = useMemo(() => {
    const partnerDeals = new Set(links.filter((link) => link.partner_id === partner).map((link) => link.deal_id));
    const visible = deals.filter((deal) => {
      if (tier && deal.tier !== tier) return false;
      if (stage && deal.deal_stage !== stage) return false;
      if (sector && deal.industry !== sector) return false;
      if (!matchesProprietary(deal.is_proprietary, proprietary)) return false;
      if (partner && !partnerDeals.has(deal.id)) return false;
      return true;
    });
    const byId = new Map(visible.map((deal) => [deal.id, deal]));
    const rows: TimelineItem[] = [];
    for (const deal of visible) {
      const date = deal.entry_date || deal.created_at;
      rows.push({
        id: `entry-${deal.id}`,
        date,
        deal,
        kind: "entry",
        label: "Entered pipeline",
        detail: TIER_CONFIG[deal.tier].label,
      });
    }
    for (const event of history) {
      const deal = byId.get(event.deal_id);
      if (!deal) continue;
      if (event.note === "Initial stage") continue;
      rows.push({
        id: event.id,
        date: event.changed_at,
        deal,
        kind: "history",
        label: event.field === "tier" ? "Board change" : "Stage change",
        detail: `${event.from_value || "—"} → ${event.to_value || "—"}`,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [deals, history, links, partner, proprietary, sector, stage, tier]);

  const groups = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const item of items) {
      const key = monthKey(item.date);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  const filters = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <select className="h-8 rounded-full border border-border bg-card px-3 text-xs" value={tier} onChange={(event) => setTier(event.target.value as DealTier | "")}>
        <option value="">All boards</option>
        {TIER_ORDER.map((item) => <option key={item} value={item}>{TIER_CONFIG[item].label}</option>)}
      </select>
      <select className="h-8 rounded-full border border-border bg-card px-3 text-xs" value={stage} onChange={(event) => setStage(event.target.value as DealStage | "")}>
        <option value="">All stages</option>
        {DEAL_STAGES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select className="h-8 rounded-full border border-border bg-card px-3 text-xs" value={sector} onChange={(event) => setSector(event.target.value)}>
        <option value="">All industries</option>
        {INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <ProprietaryFilter value={proprietary} onChange={setProprietary} />
      <select className="h-8 rounded-full border border-border bg-card px-3 text-xs" value={partner} onChange={(event) => setPartner(event.target.value)}>
        <option value="">All partners</option>
        {partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </div>
  );

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading timeline…</p>;
  if (error && deals.length === 0) return <p className="p-6 text-sm text-destructive" role="alert">{error}</p>;

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.03em]">Timeline</h1>
          <p className="text-xs text-muted-foreground">Entries and stage changes, newest first.</p>
        </div>
        <div className="hidden md:block">{filters}</div>
        <button type="button" className="press h-8 rounded-full border border-border px-3 text-xs md:hidden" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="mr-1 inline size-3.5" />
          Filters
        </button>
      </div>
      {historyError && <p className="mb-4 text-sm text-destructive" role="alert">{historyError}</p>}
      {groups.length === 0 && (
        deals.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <p>No deals yet. The timeline fills in as you add deals and move them between stages.</p>
            <button type="button" className="mt-3 inline-flex h-8 items-center rounded-full bg-foreground px-3 text-xs font-medium text-background" onClick={() => router.push("/")}>Create your first deal</button>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches these filters.</p>
        )
      )}
      <div className="space-y-8">
        {groups.map(([month, rows]) => (
          <section key={month}>
            <h2 className="sticky top-0 z-10 bg-background py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{month}</h2>
            <ol className="relative border-l border-border pl-5">
              {rows.map((item) => (
                <li key={item.id} className="relative pb-5">
                  <span className="absolute -left-[23px] top-1.5 size-2.5 rounded-full border-2 border-background bg-foreground" />
                  <button
                    type="button"
                    className="press w-full rounded-2xl bg-card p-3 text-left shadow-card"
                    onClick={() => router.push(openDealQuery(pathname, searchParams.toString(), item.deal.id))}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.deal.company_name}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(item.date, "d MMM")}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.label} · {item.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Tag tone={TIER_CONFIG[item.deal.tier].tone}>{TIER_CONFIG[item.deal.tier].label}</Tag>
                      <IndustryChip industry={item.deal.industry} />
                      {item.deal.deal_stage && <Tag tone={stageTone(item.deal.deal_stage)}>{displayStage(item.deal.deal_stage)}</Tag>}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-4 transition-[transform] duration-300 ease-drawer">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    </div>
  );
}
