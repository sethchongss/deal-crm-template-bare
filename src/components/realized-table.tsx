"use client";

import { useEffect, useState } from "react";
import { DateField } from "@/components/task-dates";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import type { RealizedDeal, RealizedStatus } from "@/types/database";
import { STATUS_CONFIG } from "@/lib/constants";
import { Tag } from "@/components/tag";
import { formatDate } from "@/lib/format";

const field = "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:shadow-focus";
const labelClass = "mb-1 block text-[11px] font-medium text-muted-foreground";
const STATUSES: RealizedStatus[] = ["closed", "analysis", "portfolio"];

export function RealizedTable() {
  const [deals, setDeals] = useState<RealizedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("realized_deals").select("*").order("entry_date", { ascending: false }).then(({ data, error: fetchError }) => {
      if (cancelled) return;
      if (fetchError) setError(fetchError.message);
      else setDeals(data || []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = deals.find((deal) => deal.id === selectedId) ?? null;

  if (loading) return <p className="py-16 text-center text-sm text-muted-foreground">Loading realized deals…</p>;
  if (error) return <p className="py-16 text-center text-sm text-destructive" role="alert">{error}</p>;
  if (deals.length === 0) return <p className="py-16 text-center text-sm text-muted-foreground">No realized deals yet.</p>;

  return (
    <div className="h-full overflow-auto rounded-2xl bg-card shadow-card">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-2 py-2 font-medium">Company</th>
            <th className="px-2 py-2 font-medium">Team</th>
            <th className="hidden px-2 py-2 font-medium md:table-cell">Source</th>
            <th className="hidden px-2 py-2 font-medium lg:table-cell">Sector</th>
            <th className="hidden px-2 py-2 font-medium md:table-cell">Country</th>
            <th className="px-2 py-2 text-right font-medium">Sales</th>
            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">EBITDA</th>
            <th className="hidden px-2 py-2 font-medium lg:table-cell">Entry</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id} className="cursor-pointer border-t border-border hoverable:hover:bg-accent" onClick={() => setSelectedId(deal.id)}>
              <td className="px-4 py-2.5"><Tag tone={STATUS_CONFIG[deal.status].tone}>{STATUS_CONFIG[deal.status].label}</Tag></td>
              <td className="px-2 py-2.5 font-medium">{deal.company_name}</td>
              <td className="px-2 py-2.5 text-muted-foreground">{deal.team_member || "—"}</td>
              <td className="hidden px-2 py-2.5 text-muted-foreground md:table-cell">{deal.source || "—"}</td>
              <td className="hidden px-2 py-2.5 text-muted-foreground lg:table-cell">{deal.sector || "—"}</td>
              <td className="hidden px-2 py-2.5 text-muted-foreground md:table-cell">{deal.country || "—"}</td>
              <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">{deal.sales || "—"}</td>
              <td className="hidden px-2 py-2.5 text-right font-mono text-xs tabular-nums sm:table-cell">{deal.ebitda || "—"}</td>
              <td className="hidden px-2 py-2.5 text-muted-foreground lg:table-cell">{formatDate(deal.entry_date, "d MMM yy")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-auto p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Edit realized deal</SheetTitle>
          {selected ? (
            <RealizedEditor
              deal={selected}
              onSaved={(next) => setDeals((current) => current.map((row) => (row.id === next.id ? next : row)))}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RealizedEditor({
  deal,
  onSaved,
}: {
  deal: RealizedDeal;
  onSaved: (deal: RealizedDeal) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: Partial<RealizedDeal>) => {
    const { data, error: saveError } = await supabase.from("realized_deals").update(patch).eq("id", deal.id).select().single();
    if (saveError || !data) {
      setError(saveError?.message || "Couldn't save this realized deal.");
      return;
    }
    setError(null);
    onSaved(data);
  };

  return (
    <div className="space-y-4 p-5">
      <h2 className="pr-8 text-lg font-semibold tracking-[-0.03em]">Realized deal</h2>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <label><span className={labelClass}>Company</span>
        <input className={field} defaultValue={deal.company_name} onBlur={(event) => {
          const company_name = event.target.value.trim();
          if (company_name && company_name !== deal.company_name) void save({ company_name });
        }} />
      </label>
      <label><span className={labelClass}>Status</span>
        <select className={field} value={deal.status} onChange={(event) => void save({ status: event.target.value as RealizedStatus })}>
          {STATUSES.map((status) => <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>)}
        </select>
      </label>
      <label><span className={labelClass}>Team</span>
        <input className={field} defaultValue={deal.team_member ?? ""} onBlur={(event) => void save({ team_member: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Source</span>
        <input className={field} defaultValue={deal.source ?? ""} onBlur={(event) => void save({ source: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Sector</span>
        <input className={field} defaultValue={deal.sector ?? ""} onBlur={(event) => void save({ sector: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Country</span>
        <input className={field} defaultValue={deal.country ?? ""} onBlur={(event) => void save({ country: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Sales</span>
        <input className={`${field} font-mono`} defaultValue={deal.sales ?? ""} onBlur={(event) => void save({ sales: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>EBITDA</span>
        <input className={`${field} font-mono`} defaultValue={deal.ebitda ?? ""} onBlur={(event) => void save({ ebitda: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Debt</span>
        <input className={`${field} font-mono`} defaultValue={deal.debt ?? ""} onBlur={(event) => void save({ debt: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Entry date</span>
        <DateField label="Entry date" value={deal.entry_date} onChange={(value) => void save({ entry_date: value })} />
      </label>
      <label><span className={labelClass}>Deal type</span>
        <input className={field} defaultValue={deal.deal_type ?? ""} onBlur={(event) => void save({ deal_type: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Owners</span>
        <input className={field} defaultValue={deal.owners ?? ""} onBlur={(event) => void save({ owners: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Description</span>
        <textarea className={`${field} min-h-20 py-2`} defaultValue={deal.description ?? deal.company_description ?? ""} onBlur={(event) => void save({ description: event.target.value.trim() || null })} />
      </label>
      <label><span className={labelClass}>Comments</span>
        <textarea className={`${field} min-h-16 py-2`} defaultValue={deal.comments ?? ""} onBlur={(event) => void save({ comments: event.target.value.trim() || null })} />
      </label>
    </div>
  );
}
