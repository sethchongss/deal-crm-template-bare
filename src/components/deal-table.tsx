"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { CountryChip } from "@/components/country-chip";
import { IndustryChip } from "@/components/industry-chip";
import { ProprietaryFilter } from "@/components/proprietary-filter";
import { Tag } from "@/components/tag";
import { useCrm } from "@/components/crm-provider";
import { ViaClaude } from "@/components/via-claude";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TIER_CONFIG, TIER_ORDER } from "@/lib/constants";
import { INDUSTRIES } from "@/lib/industries";
import { PASSED_TONE, PROPRIETARY_TONE } from "@/lib/tag-styles";
import { displayStage, passedAtLabel, stageTone } from "@/lib/passed";
import { formatDate, moneyLabel } from "@/lib/format";
import { matchesProprietary, type ProprietaryFilterValue } from "@/lib/proprietary";
import type { Deal, DealStage, DealTier } from "@/types/database";
import { DEAL_STAGES } from "@/types/database";
import { cn } from "@/lib/utils";

type SortKey = "company_name" | "tier" | "deal_stage" | "industry" | "country" | "sales_amount" | "ebitda_amount" | "net_debt_amount" | "entry_date";

const pill = "press h-8 rounded-full border border-border bg-card px-3 text-xs text-foreground";

export function DealTable({ onSelect }: { onSelect: (deal: Deal) => void }) {
  const { deals, partners, links, claudeMarks, loading, error } = useCrm();
  const [tier, setTier] = useState<DealTier | "">("");
  const [stage, setStage] = useState<DealStage | "">("");
  const [sector, setSector] = useState("");
  const [country, setCountry] = useState("");
  const [proprietary, setProprietary] = useState<ProprietaryFilterValue>("all");
  const [partner, setPartner] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("company_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");

  const countries = useMemo(() => {
    const values = new Set<string>();
    for (const deal of deals) {
      for (const name of deal.countries || []) values.add(name);
      if (deal.country) values.add(deal.country);
    }
    return [...values].sort();
  }, [deals]);

  const rows = useMemo(() => {
    const partnerDeals = new Set(links.filter((link) => link.partner_id === partner).map((link) => link.deal_id));
    const filtered = deals.filter((deal) => {
      if (deal.archived) return false;
      if (query && !deal.company_name.toLowerCase().includes(query.toLowerCase())) return false;
      if (tier && deal.tier !== tier) return false;
      if (stage && deal.deal_stage !== stage) return false;
      if (sector && deal.industry !== sector) return false;
      if (country && deal.country !== country && !(deal.countries || []).includes(country)) return false;
      if (!matchesProprietary(deal.is_proprietary, proprietary)) return false;
      if (partner && !partnerDeals.has(deal.id)) return false;
      return true;
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (typeof left === "number" || typeof right === "number") {
        return ((left as number | null) ?? -Infinity) > ((right as number | null) ?? -Infinity) ? direction : -direction;
      }
      return String(left ?? "").localeCompare(String(right ?? "")) * direction;
    });
  }, [country, deals, links, partner, proprietary, query, sector, sortDir, sortKey, stage, tier]);

  const salesCurrencies = new Set(rows.map((deal) => deal.fin_currency).filter(Boolean));
  const salesSum = salesCurrencies.size === 1
    ? rows.reduce((sum, deal) => sum + (deal.sales_amount ?? 0), 0)
    : null;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key.endsWith("amount") ? "desc" : "asc");
    }
  };

  const filters = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <input className="h-8 w-full rounded-full border border-border bg-card px-3 text-xs sm:w-44" placeholder="Search company" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select className={pill} value={tier} onChange={(event) => setTier(event.target.value as DealTier | "")}>
        <option value="">All boards</option>
        {TIER_ORDER.map((item) => <option key={item} value={item}>{TIER_CONFIG[item].label}</option>)}
      </select>
      <select className={pill} value={stage} onChange={(event) => setStage(event.target.value as DealStage | "")}>
        <option value="">All stages</option>
        {DEAL_STAGES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select className={pill} value={sector} onChange={(event) => setSector(event.target.value)}>
        <option value="">All industries</option>
        {INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select className={pill} value={country} onChange={(event) => setCountry(event.target.value)}>
        <option value="">All countries</option>
        {countries.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <ProprietaryFilter value={proprietary} onChange={setProprietary} />
      <select className={pill} value={partner} onChange={(event) => setPartner(event.target.value)}>
        <option value="">All partners</option>
        {partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </div>
  );

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading deals…</p>;
  if (error && deals.length === 0) return <p className="p-6 text-sm text-destructive" role="alert">{error}</p>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="hidden min-w-0 flex-1 md:block">{filters}</div>
        <button type="button" className={`${pill} md:hidden`} onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="mr-1 inline size-3.5" />
          Filters
        </button>
        <p className="text-xs tabular-nums text-muted-foreground">{rows.length} deals</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-[13px] md:min-w-full">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <Head label="Company" onClick={() => toggleSort("company_name")} active={sortKey === "company_name"} />
              <Head label="Board" onClick={() => toggleSort("tier")} active={sortKey === "tier"} className="hidden sm:table-cell" />
              <Head label="Stage" onClick={() => toggleSort("deal_stage")} active={sortKey === "deal_stage"} />
              <Head label="Industry" onClick={() => toggleSort("industry")} active={sortKey === "industry"} className="hidden lg:table-cell" />
              <Head label="Country" onClick={() => toggleSort("country")} active={sortKey === "country"} className="hidden md:table-cell" />
              <Head label="Sales" onClick={() => toggleSort("sales_amount")} active={sortKey === "sales_amount"} align="right" />
              <Head label="EBITDA" onClick={() => toggleSort("ebitda_amount")} active={sortKey === "ebitda_amount"} align="right" className="hidden md:table-cell" />
              <Head label="ND" onClick={() => toggleSort("net_debt_amount")} active={sortKey === "net_debt_amount"} align="right" className="hidden lg:table-cell" />
              <Head label="Entry" onClick={() => toggleSort("entry_date")} active={sortKey === "entry_date"} className="hidden xl:table-cell" />
            </tr>
          </thead>
          <tbody>
            {rows.map((deal) => {
              const claude = claudeMarks.find((mark) => mark.table_name === "deals" && mark.row_id === deal.id);
              return (
              <tr key={deal.id} className="cursor-pointer border-b border-border hoverable:hover:bg-accent" onClick={() => onSelect(deal)}>
                <td className="border-b border-border px-4 py-2.5 font-medium md:px-6">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {deal.company_name}
                    {deal.is_proprietary && <Tag tone={PROPRIETARY_TONE}>Proprietary</Tag>}
                    {claude && <ViaClaude auditId={claude.id} actor={claude.actor_label} stop />}
                  </span>
                </td>
                <td className="hidden border-b border-border px-2 py-2.5 sm:table-cell"><Tag tone={TIER_CONFIG[deal.tier].tone}>{TIER_CONFIG[deal.tier].label}</Tag></td>
                <td className="border-b border-border px-2 py-2.5">
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {deal.is_passed && <Tag tone={PASSED_TONE}>Passed</Tag>}
                    {deal.deal_stage ? <Tag tone={stageTone(deal.deal_stage)}>{deal.is_passed ? passedAtLabel(deal.deal_stage) : displayStage(deal.deal_stage)}</Tag> : "—"}
                  </span>
                </td>
                <td className="hidden border-b border-border px-2 py-2.5 lg:table-cell">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <IndustryChip industry={deal.industry} />
                    {deal.sector && <span className="text-muted-foreground">{deal.sector}</span>}
                    {!deal.industry && !deal.sector && "—"}
                  </span>
                </td>
                <td className="hidden border-b border-border px-2 py-2.5 md:table-cell">{deal.country ? <CountryChip country={deal.country} /> : "—"}</td>
                <Money value={moneyLabel(deal.sales_amount, deal.fin_currency) || deal.latest_sales} />
                <Money value={moneyLabel(deal.ebitda_amount, deal.fin_currency) || deal.latest_ebitda} className="hidden md:table-cell" />
                <Money value={moneyLabel(deal.net_debt_amount, deal.fin_currency) || deal.net_debt_cash} className="hidden lg:table-cell" />
                <td className="hidden border-b border-border px-2 py-2.5 text-muted-foreground xl:table-cell">{formatDate(deal.entry_date, "d MMM yy")}</td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center text-sm text-muted-foreground">
                  {deals.length === 0 ? (
                    <>No deals yet. <Link href="/" className="font-medium text-foreground underline">Create your first deal</Link> on the pipeline board.</>
                  ) : "No deals match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-border bg-background px-4 py-2.5 text-xs md:px-6">
        <span className="tabular-nums">{rows.length} in view</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {salesSum != null ? `Sales ${moneyLabel(salesSum, [...salesCurrencies][0])}` : "Mixed currencies"}
        </span>
      </footer>
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-4 transition-[transform] duration-300 ease-drawer">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Head({ label, onClick, active, align, className }: { label: string; onClick: () => void; active: boolean; align?: "right"; className?: string }) {
  return (
    <th className={cn("border-b border-border px-2 py-2 font-medium", align === "right" && "text-right", className)}>
      <button type="button" className={cn("press", active && "text-foreground")} onClick={onClick}>{label}</button>
    </th>
  );
}

function Money({ value, className }: { value: string | null | undefined; className?: string }) {
  return <td className={cn("border-b border-border px-2 py-2.5 text-right font-mono text-xs tabular-nums", className)}>{value || "—"}</td>;
}
