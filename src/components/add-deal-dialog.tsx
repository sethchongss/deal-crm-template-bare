"use client";

import { useState } from "react";
import { DocumentDrop } from "@/components/document-drop";
import { DateField } from "@/components/task-dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEAL_STAGE_OPTIONS, TIER_CONFIG, TIER_ORDER, TRANSACTION_TYPES } from "@/lib/constants";
import { INDUSTRIES } from "@/lib/industries";
import type { ExtractedDeal } from "@/lib/extract-deal";
import type { Deal, DealStage, DealTier } from "@/types/database";

interface AddDealDialogProps {
  open: boolean;
  defaultTier: DealTier;
  onClose: () => void;
  onCreate: (deal: Partial<Deal> & { company_name: string }) => Promise<Deal | null>;
}

const empty = {
  company_name: "",
  legal_name: "",
  industry: "",
  sector: "",
  country: "",
  source: "",
  owners: "",
  company_description: "",
  latest_sales: "",
  latest_ebitda: "",
  net_debt_cash: "",
  financial_year: "",
  enterprise_value: "",
  transaction_type: "",
  stake_percent: "",
  ticket_size: "",
  vendor: "",
  entry_date: "",
  target_completion_date: "",
  exclusivity_end_date: "",
  exclusivity_extension_date: "",
  deal_stage: "Screening/Pipeline" as DealStage,
};

type FormState = typeof empty;
const field = "mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:shadow-focus";

export function AddDealDialog({ open, defaultTier, onClose, onCreate }: AddDealDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        {open && <AddDealForm key={defaultTier} defaultTier={defaultTier} onClose={onClose} onCreate={onCreate} />}
      </DialogContent>
    </Dialog>
  );
}

function AddDealForm({ defaultTier, onClose, onCreate }: Omit<AddDealDialogProps, "open">) {
  const [tier, setTier] = useState<DealTier>(defaultTier);
  const [proprietary, setProprietary] = useState(false);
  const [form, setForm] = useState<FormState>(() => ({ ...empty, entry_date: new Date().toISOString().slice(0, 10) }));
  const [fromDoc, setFromDoc] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const mark = (key: string) => fromDoc.includes(key) ? <span className="ml-1 text-[10px] font-medium text-[var(--brand)]">from document</span> : null;

  const applyExtract = (deal: ExtractedDeal, fields: string[]) => {
    set({
      company_name: deal.deal_name || form.company_name,
      legal_name: deal.company || "",
      sector: deal.sector || "",
      country: deal.country || "",
      source: deal.source || "",
      owners: form.owners,
      company_description: [deal.description, deal.other_financials].filter(Boolean).join("\n\n"),
      latest_sales: deal.revenue || "",
      latest_ebitda: deal.ebitda || "",
      net_debt_cash: deal.net_debt || "",
      financial_year: deal.financial_year || "",
      enterprise_value: deal.enterprise_value || "",
      transaction_type: deal.transaction_type || "",
      stake_percent: deal.stake_percent == null ? "" : String(deal.stake_percent),
      ticket_size: deal.ticket_size || "",
      vendor: deal.ownership || "",
    });
    setFromDoc(fields);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    setError(null);
    const stakeRaw = form.stake_percent.trim();
    const stake = stakeRaw === "" ? null : Number(stakeRaw);
    if (stakeRaw !== "" && (!Number.isFinite(stake) || stake! < 0 || stake! > 100)) {
      setSaving(false);
      setError("Stake must be a number from 0 to 100.");
      return;
    }
    const result = await onCreate({
      company_name: form.company_name.trim(),
      legal_name: form.legal_name || null,
      tier,
      deal_stage: form.deal_stage,
      industry: form.industry || null,
      sector: form.sector || null,
      country: form.country || null,
      source: form.source || null,
      owners: form.owners || null,
      company_description: form.company_description || null,
      latest_sales: form.latest_sales || null,
      latest_ebitda: form.latest_ebitda || null,
      net_debt_cash: form.net_debt_cash || null,
      financial_year: form.financial_year || null,
      enterprise_value: form.enterprise_value || null,
      transaction_type: form.transaction_type || null,
      stake_percent: stake,
      ticket_size: form.ticket_size || null,
      vendor: form.vendor || null,
      entry_date: form.entry_date || null,
      target_completion_date: form.target_completion_date || null,
      exclusivity_end_date: form.exclusivity_end_date || null,
      exclusivity_extension_date: form.exclusivity_extension_date || null,
      is_proprietary: proprietary,
      is_passed: tier === "passed",
      passed: tier === "passed",
      passed_at: tier === "passed" ? new Date().toISOString() : null,
    });
    setSaving(false);
    if (!result) {
      setError("Couldn't create this deal.");
      return;
    }
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New deal</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <DocumentDrop onExtracted={applyExtract} />
        <p className="text-xs text-muted-foreground">Review anything marked “from document” before you create the deal. Nothing is saved until then.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Deal name{mark("deal_name")}
            <input className={field} value={form.company_name} onChange={(event) => set({ company_name: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Company{mark("company")}
            <input className={field} value={form.legal_name} onChange={(event) => set({ legal_name: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Board
            <select className={field} value={tier} onChange={(event) => setTier(event.target.value as DealTier)}>
              {TIER_ORDER.map((item) => <option key={item} value={item}>{TIER_CONFIG[item].label}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Stage
            <select className={field} value={form.deal_stage} onChange={(event) => set({ deal_stage: event.target.value as DealStage })}>
              {DEAL_STAGE_OPTIONS.filter((stage) => stage !== "Passed").map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Industry
            <select className={field} value={form.industry} onChange={(event) => set({ industry: event.target.value })}>
              <option value="">None</option>
              {INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Sub-sector{mark("sector")}
            <input className={field} value={form.sector} placeholder="Free text" onChange={(event) => set({ sector: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Country{mark("country")}
            <input className={field} value={form.country} onChange={(event) => set({ country: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Source{mark("source")}
            <input className={field} value={form.source} onChange={(event) => set({ source: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Deal lead
            <input className={field} value={form.owners} onChange={(event) => set({ owners: event.target.value })} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-muted-foreground sm:col-span-2">
            <input type="checkbox" checked={proprietary} onChange={(event) => setProprietary(event.target.checked)} />
            Proprietary
          </label>
        </div>
        <label className="block text-xs text-muted-foreground">Description{mark("description")}
          <textarea className={`${field} min-h-20 py-2`} value={form.company_description} onChange={(event) => set({ company_description: event.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">Revenue{mark("revenue")}
            <input className={`${field} font-mono`} value={form.latest_sales} placeholder="S$12M" onChange={(event) => set({ latest_sales: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">EBITDA{mark("ebitda")}
            <input className={`${field} font-mono`} value={form.latest_ebitda} onChange={(event) => set({ latest_ebitda: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Net debt{mark("net_debt")}
            <input className={`${field} font-mono`} value={form.net_debt_cash} onChange={(event) => set({ net_debt_cash: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">FY{mark("financial_year")}
            <input className={field} value={form.financial_year} placeholder="FY2025" onChange={(event) => set({ financial_year: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Asking valuation{mark("enterprise_value")}
            <input className={`${field} font-mono`} value={form.enterprise_value} onChange={(event) => set({ enterprise_value: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Type{mark("transaction_type")}
            <input className={field} list="new-deal-types" value={form.transaction_type} onChange={(event) => set({ transaction_type: event.target.value })} />
            <datalist id="new-deal-types">{TRANSACTION_TYPES.map((type) => <option key={type} value={type} />)}</datalist>
          </label>
          <label className="text-xs text-muted-foreground">Stake %{mark("stake_percent")}
            <input className={field} value={form.stake_percent} onChange={(event) => set({ stake_percent: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Ticket{mark("ticket_size")}
            <input className={field} value={form.ticket_size} onChange={(event) => set({ ticket_size: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Vendor{mark("ownership")}
            <input className={field} value={form.vendor} onChange={(event) => set({ vendor: event.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">Entry date
            <div className="mt-1"><DateField label="Entry date" value={form.entry_date || null} onChange={(value) => set({ entry_date: value || "" })} /></div>
          </label>
          <label className="text-xs text-muted-foreground">Target completion
            <div className="mt-1"><DateField label="Target completion" value={form.target_completion_date || null} onChange={(value) => set({ target_completion_date: value || "" })} /></div>
          </label>
          <label className="text-xs text-muted-foreground">Exclusivity ends
            <div className="mt-1"><DateField label="Exclusivity ends" value={form.exclusivity_end_date || null} onChange={(value) => set({ exclusivity_end_date: value || "" })} /></div>
          </label>
          <label className="text-xs text-muted-foreground">Extension
            <div className="mt-1"><DateField label="Extension" value={form.exclusivity_extension_date || null} onChange={(value) => set({ exclusivity_extension_date: value || "" })} /></div>
          </label>
        </div>
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || !form.company_name.trim()}>{saving ? "Creating…" : "Create deal"}</Button>
        </div>
      </div>
    </>
  );
}
