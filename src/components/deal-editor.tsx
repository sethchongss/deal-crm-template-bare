"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCrm } from "@/components/crm-provider";
import { DealPartnerCard, PartnerAvatar, PartnerTags } from "@/components/partner-avatar";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/task-dates";
import { CURRENCY_OPTIONS, amountInputValue, amountToText, formatMultiple, formatPercent, marginPercent, valuationMultiple } from "@/lib/deal-form";
import { DEAL_STAGE_OPTIONS, PARTNER_ROLES, PARTNER_ROLE_CONFIG, ROLE_ON_DEAL_LABEL, ROLES_ON_DEAL, TIER_CONFIG, TIER_ORDER, TRANSACTION_TYPES } from "@/lib/constants";
import { INDUSTRIES } from "@/lib/industries";
import { passedFlagsAfterTierMove, placeAtTop, topSortOrderForBoard } from "@/lib/kanban-order";
import { supabase } from "@/lib/supabase";
import type { Deal, DealStage, DealTier, PartnerRole, RoleOnDeal } from "@/types/database";

const field = "h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:shadow-focus";
const labelClass = "mb-1 block text-[11px] font-medium text-muted-foreground";

function AutoTextarea({ value, onChange, onBlur }: { value: string; onChange: (value: string) => void; onBlur: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      className="min-h-16 w-full resize-none overflow-hidden rounded-lg border border-border bg-background px-2.5 py-2 text-sm leading-5 outline-none focus-visible:shadow-focus"
    />
  );
}

const COUNTRIES = ["Singapore", "Malaysia", "Indonesia", "Hong Kong", "Vietnam", "Thailand", "Philippines", "Australia", "Japan", "China", "India"];

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <h2 className="text-sm font-semibold tracking-[-0.02em]">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function DealEditor({ deal, afterTransaction }: { deal: Deal; afterTransaction?: ReactNode }) {
  const { deals, partners, links, updateDeal, reorderDeals, refresh, refreshLinks, notify } = useCrm();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reason, setReason] = useState(deal.passed_reason || deal.pass_reason || "");
  const [partnerQuery, setPartnerQuery] = useState("");
  const [roleOnDeal, setRoleOnDeal] = useState<RoleOnDeal>("advisor");
  const [newPartner, setNewPartner] = useState("");
  const [newPartnerRole, setNewPartnerRole] = useState<PartnerRole>("advisors");
  const [sales, setSales] = useState(amountInputValue(deal.sales_amount));
  const [ebitda, setEbitda] = useState(amountInputValue(deal.ebitda_amount));
  const [debt, setDebt] = useState(amountInputValue(deal.net_debt_amount));
  const [currency, setCurrency] = useState(deal.fin_currency || "SGD");

  useEffect(() => {
    setSales(amountInputValue(deal.sales_amount));
    setEbitda(amountInputValue(deal.ebitda_amount));
    setDebt(amountInputValue(deal.net_debt_amount));
    setCurrency(deal.fin_currency || "SGD");
    setReason(deal.passed_reason || deal.pass_reason || "");
  }, [deal.id, deal.sales_amount, deal.ebitda_amount, deal.net_debt_amount, deal.fin_currency, deal.passed_reason, deal.pass_reason]);

  const save = async (patch: Partial<Deal>) => {
    setStatus("saving");
    const ok = await updateDeal(deal.id, patch);
    setStatus(ok ? "saved" : "error");
    if (ok) notify("Saved");
    return ok;
  };

  const saveAmount = (key: "latest_sales" | "latest_ebitda" | "net_debt_cash", value: string) => {
    void save({ [key]: amountToText(value, currency) });
  };

  const moveToBoard = async (tier: DealTier, extra: Partial<Deal> = {}) => {
    if (deal.archived) {
      await save({ tier, sort_order: topSortOrderForBoard(deals, tier, deal.id), ...extra });
      return;
    }
    setStatus("saving");
    const placed = await reorderDeals(placeAtTop({ deals, movingId: deal.id, destinationTier: tier }));
    if (!placed) {
      setStatus("error");
      return;
    }
    if (Object.keys(extra).length === 0) {
      setStatus("saved");
      notify("Saved");
      return;
    }
    await save(extra);
  };

  const markPassed = async () => {
    await moveToBoard("passed", {
      is_passed: true,
      passed: true,
      passed_at: deal.passed_at ?? new Date().toISOString(),
      passed_reason: reason.trim() || null,
      pass_reason: reason.trim() || deal.pass_reason,
    });
  };

  const returnToPipeline = async () => {
    await moveToBoard("pipeline", {
      is_passed: false,
      passed: false,
      passed_at: null,
    });
  };

  const dealLinks = useMemo(() => links.filter((link) => link.deal_id === deal.id), [links, deal.id]);
  const linkedIds = useMemo(() => new Set(dealLinks.map((link) => link.partner_id)), [dealLinks]);
  const suggestions = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase();
    return partners.filter((partner) => !linkedIds.has(partner.id) && (!q || partner.name.toLowerCase().includes(q))).slice(0, 6);
  }, [partnerQuery, partners, linkedIds]);

  const margin = formatPercent(marginPercent(deal.sales_amount, deal.ebitda_amount));
  const multiple = formatMultiple(valuationMultiple(deal.enterprise_value, deal.ebitda_amount));

  const linkPartner = async (partnerId: string) => {
    const { error } = await supabase.from("deal_partners").insert({ deal_id: deal.id, partner_id: partnerId, role_on_deal: roleOnDeal });
    if (error) {
      setStatus("error");
      return;
    }
    setPartnerQuery("");
    setStatus("saved");
    notify("Partner linked");
    await refreshLinks();
  };

  const createAndLink = async () => {
    const name = newPartner.trim();
    if (!name) return;
    const { data, error } = await supabase.from("partners").insert({ name, role: newPartnerRole }).select().single();
    if (error || !data) {
      setStatus("error");
      return;
    }
    setNewPartner("");
    await refresh();
    await linkPartner(data.id);
  };

  return (
    <div className="space-y-6">
      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved"}
        {status === "error" && "Couldn't save. If this is a new field, the latest migration still needs to be applied."}
        {status === "idle" && "Edits save as you leave a field."}
      </p>

      <Section title="Overview" hint="Name, where it sits, and who owns it.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className={labelClass}>Deal name</span>
            <input className={field} defaultValue={deal.company_name} onBlur={(event) => void save({ company_name: event.target.value.trim() || deal.company_name })} />
          </label>
          <label><span className={labelClass}>Company</span>
            <input className={field} defaultValue={deal.legal_name ?? ""} placeholder="Legal entity" onBlur={(event) => void save({ legal_name: event.target.value.trim() || null })} />
          </label>
          <label><span className={labelClass}>Industry</span>
            <select className={field} value={deal.industry ?? ""} onChange={(event) => void save({ industry: event.target.value || null })}>
              <option value="">None</option>
              {INDUSTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label><span className={labelClass}>Sub-sector</span>
            <input className={field} defaultValue={deal.sector ?? ""} placeholder="Free text" onBlur={(event) => void save({ sector: event.target.value.trim() || null })} />
          </label>
          <label><span className={labelClass}>Country</span>
            <input className={field} list="country-options" defaultValue={deal.country ?? ""} placeholder="Singapore / Malaysia" onBlur={(event) => void save({ country: event.target.value.trim() || null })} />
            <datalist id="country-options">{COUNTRIES.map((country) => <option key={country} value={country} />)}</datalist>
          </label>
          <label><span className={labelClass}>Source</span>
            <input className={field} defaultValue={deal.source ?? ""} onBlur={(event) => void save({ source: event.target.value.trim() || null })} />
          </label>
          <label><span className={labelClass}>Deal lead</span>
            <input className={field} defaultValue={deal.owners ?? ""} onBlur={(event) => void save({ owners: event.target.value.trim() || null })} />
          </label>
          <label><span className={labelClass}>Board</span>
            <select className={field} value={deal.tier} onChange={(event) => {
              const tier = event.target.value as DealTier;
              const extra: Partial<Deal> = {};
              const change = passedFlagsAfterTierMove(deal.tier, tier);
              if (change === "set") {
                extra.is_passed = true;
                extra.passed = true;
                extra.passed_at = deal.passed_at ?? new Date().toISOString();
              } else if (change === "clear") {
                extra.is_passed = false;
                extra.passed = false;
                extra.passed_at = null;
              }
              void moveToBoard(tier, extra);
            }}>
              {TIER_ORDER.map((tier) => <option key={tier} value={tier}>{TIER_CONFIG[tier].label}</option>)}
            </select>
          </label>
          <label><span className={labelClass}>Stage</span>
            <select className={field} value={deal.deal_stage === "Passed" ? "Screening/Pipeline" : deal.deal_stage ?? "Screening/Pipeline"} onChange={(event) => void save({ deal_stage: event.target.value as DealStage })}>
              {DEAL_STAGE_OPTIONS.filter((stage) => stage !== "Passed").map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-3 block"><span className={labelClass}>Pass reason</span>
          <AutoTextarea
            value={reason}
            onChange={setReason}
            onBlur={() => {
              const next = reason.trim() || null;
              const stored = (deal.passed_reason || deal.pass_reason || "").trim() || null;
              if (next === stored) return;
              void save({ passed_reason: next, pass_reason: next });
            }}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {deal.is_passed || deal.tier === "passed" ? (
            <Button type="button" variant="outline" onClick={() => void returnToPipeline()}>Return to Pipeline</Button>
          ) : (
            <Button type="button" onClick={() => void markPassed()}>Mark as passed</Button>
          )}
          <Button type="button" variant={deal.is_proprietary ? "default" : "outline"} onClick={() => void save({ is_proprietary: !deal.is_proprietary })}>Proprietary</Button>
          <Button type="button" variant={deal.nbo ? "default" : "outline"} onClick={() => void save({ nbo: !deal.nbo })}>NBIO</Button>
          <Button type="button" variant={deal.dd ? "default" : "outline"} onClick={() => void save({ dd: !deal.dd })}>Due diligence</Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className={labelClass}>Entry date</span>
            <DateField label="Entry date" value={deal.entry_date} onChange={(value) => void save({ entry_date: value })} />
          </label>
          <label><span className={labelClass}>Target completion</span>
            <DateField label="Target completion" value={deal.target_completion_date} onChange={(value) => void save({ target_completion_date: value })} />
          </label>
          <label><span className={labelClass}>Exclusivity ends</span>
            <DateField label="Exclusivity ends" value={deal.exclusivity_end_date} onChange={(value) => void save({ exclusivity_end_date: value })} />
          </label>
          <label><span className={labelClass}>Extension</span>
            <DateField label="Extension" value={deal.exclusivity_extension_date} onChange={(value) => void save({ exclusivity_extension_date: value })} />
          </label>
        </div>
        <label className="mt-3 block"><span className={labelClass}>Description</span>
          <textarea className={`${field} min-h-20 py-2`} defaultValue={deal.company_description ?? ""} onBlur={(event) => void save({ company_description: event.target.value.trim() || null })} />
        </label>
      </Section>

      <Section title="Financials" hint="Amounts are in millions. Margin is EBITDA / revenue. The multiple is asking valuation / EBITDA.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className={labelClass}>Currency</span>
            <select className={field} value={currency} onChange={(event) => {
              const next = event.target.value;
              setCurrency(next);
              const patch: Partial<Deal> = {};
              if (sales.trim()) patch.latest_sales = amountToText(sales, next);
              if (ebitda.trim()) patch.latest_ebitda = amountToText(ebitda, next);
              if (debt.trim()) patch.net_debt_cash = amountToText(debt, next);
              if (Object.keys(patch).length > 0) void save(patch);
            }}>
              {CURRENCY_OPTIONS.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label><span className={labelClass}>Financial year</span>
            <input className={field} defaultValue={deal.financial_year ?? ""} placeholder="FY2025" onBlur={(event) => void save({ financial_year: event.target.value.trim() || null })} />
          </label>
          <label><span className={labelClass}>Revenue (m)</span>
            <input className={`${field} font-mono`} inputMode="decimal" value={sales} onChange={(event) => setSales(event.target.value)} onBlur={() => saveAmount("latest_sales", sales)} />
          </label>
          <label><span className={labelClass}>EBITDA (m)</span>
            <input className={`${field} font-mono`} inputMode="decimal" value={ebitda} onChange={(event) => setEbitda(event.target.value)} onBlur={() => saveAmount("latest_ebitda", ebitda)} />
          </label>
          <label><span className={labelClass}>Margin</span>
            <input className={`${field} font-mono`} value={margin} readOnly aria-label="EBITDA margin" title="Calculated from revenue and EBITDA" />
          </label>
          <label><span className={labelClass}>Net debt / (cash) (m)</span>
            <input className={`${field} font-mono`} inputMode="decimal" value={debt} onChange={(event) => setDebt(event.target.value)} onBlur={() => saveAmount("net_debt_cash", debt)} />
          </label>
          <label><span className={labelClass}>EV / asking valuation</span>
            <input className={`${field} font-mono`} defaultValue={deal.enterprise_value ?? ""} placeholder="S$80M" onBlur={(event) => void save({ enterprise_value: event.target.value.trim() || null })} />
          </label>
          <label><span className={labelClass}>EV / EBITDA</span>
            <input className={`${field} font-mono`} value={multiple} readOnly aria-label="Valuation multiple" title="Calculated from asking valuation and EBITDA" />
          </label>
        </div>
      </Section>

      <Section title="Transaction">
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className={labelClass}>Type</span>
            <input className={field} list="transaction-types" defaultValue={deal.transaction_type ?? ""} onBlur={(event) => void save({ transaction_type: event.target.value.trim() || null })} />
            <datalist id="transaction-types">{TRANSACTION_TYPES.map((type) => <option key={type} value={type} />)}</datalist>
          </label>
          <label><span className={labelClass}>Stake %</span>
            <input className={field} inputMode="decimal" defaultValue={deal.stake_percent ?? ""} onBlur={(event) => {
              const raw = event.target.value.trim();
              if (!raw) {
                void save({ stake_percent: null });
                return;
              }
              const value = Number(raw);
              if (!Number.isFinite(value) || value < 0 || value > 100) {
                setStatus("error");
                return;
              }
              void save({ stake_percent: value });
            }} />
          </label>
          <label><span className={labelClass}>Ticket size</span>
            <input className={field} defaultValue={deal.ticket_size ?? ""} placeholder="S$15M" onBlur={(event) => void save({ ticket_size: event.target.value.trim() || null })} />
          </label>
          <label><span className={labelClass}>Vendor / ownership</span>
            <input className={field} defaultValue={deal.vendor ?? ""} onBlur={(event) => void save({ vendor: event.target.value.trim() || null })} />
          </label>
        </div>
      </Section>

      {afterTransaction}

      <Section title="Partners" hint="Search someone already in the book, or add them here.">
        <div className="space-y-2">
          {dealLinks.length === 0 && <p className="text-sm text-muted-foreground">No partners on this deal yet.</p>}
          {dealLinks.map((link) => {
            const partner = partners.find((item) => item.id === link.partner_id);
            const name = partner?.name || "Unknown partner";
            return (
              <DealPartnerCard
                key={link.id}
                name={name}
                type={partner?.role}
                company={partner?.company}
                roleOnDeal={link.role_on_deal}
                onRoleChange={async (role) => {
                  const { error } = await supabase.from("deal_partners").update({ role_on_deal: role }).eq("id", link.id);
                  if (error) setStatus("error");
                  else { setStatus("saved"); await refreshLinks(); }
                }}
                onRemove={async () => {
                  const { error } = await supabase.from("deal_partners").delete().eq("id", link.id);
                  if (error) setStatus("error");
                  else { setStatus("saved"); notify("Partner removed"); await refreshLinks(); }
                }}
              />
            );
          })}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className={field} value={partnerQuery} placeholder="Search partners" onChange={(event) => setPartnerQuery(event.target.value)} />
          <select className={field} value={roleOnDeal} onChange={(event) => setRoleOnDeal(event.target.value as RoleOnDeal)}>
            {ROLES_ON_DEAL.map((role) => <option key={role} value={role}>{ROLE_ON_DEAL_LABEL[role]}</option>)}
          </select>
        </div>
        {partnerQuery && (
          <ul className="mt-2 overflow-hidden rounded-xl border border-border">
            {suggestions.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No matching partner.</li>}
            {suggestions.map((partner) => (
              <li key={partner.id}>
                <button type="button" className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hoverable:hover:bg-accent" onClick={() => void linkPartner(partner.id)}>
                  <PartnerAvatar name={partner.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{partner.name}</span>
                    <span className="mt-1 block"><PartnerTags type={partner.role} company={partner.company} /></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${field} max-w-xs`} value={newPartner} placeholder="New partner name" onChange={(event) => setNewPartner(event.target.value)} />
          <select className={`${field} max-w-[10rem]`} value={newPartnerRole} onChange={(event) => setNewPartnerRole(event.target.value as PartnerRole)}>
            {PARTNER_ROLES.map((role) => <option key={role} value={role}>{PARTNER_ROLE_CONFIG[role].label}</option>)}
          </select>
          <Button type="button" variant="outline" onClick={() => void createAndLink()} disabled={!newPartner.trim()}>Create and link</Button>
        </div>
      </Section>
    </div>
  );
}
