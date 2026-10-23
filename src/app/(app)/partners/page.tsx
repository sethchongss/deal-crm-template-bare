"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { AddPartnerDialog } from "@/components/add-partner-dialog";
import { useCrm } from "@/components/crm-provider";
import { PartnerAvatar, PartnerChipList, PartnerSummary, PartnerTags } from "@/components/partner-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PARTNER_ROLE_CONFIG, PARTNER_ROLES, ROLE_ON_DEAL_LABEL, ROLES_ON_DEAL, TIER_CONFIG } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { partnerChips } from "@/lib/partners";
import { supabase } from "@/lib/supabase";
import type { Partner, PartnerNote, PartnerRole, RoleOnDeal } from "@/types/database";

export default function PartnersPage() {
  const { partners, deals, links, loading, error, createPartner, updatePartner, deletePartner, refresh } = useCrm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<PartnerRole | "">("");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const selectedId = searchParams.get("partner");
  const selected = partners.find((partner) => partner.id === selectedId) ?? null;

  const visible = useMemo(() => partners.filter((partner) => {
    if (role && partner.role !== role) return false;
    if (query) {
      const haystack = [partner.name, partner.company, partner.job_title, partner.email].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    return true;
  }), [partners, query, role]);

  const open = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("partner", id);
    router.replace(`/partners?${params.toString()}`);
  };
  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("partner");
    const next = params.toString();
    router.replace(next ? `/partners?${next}` : "/partners");
  };

  const filters = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input className="h-8 rounded-full border border-border bg-card px-3 text-xs sm:w-48" placeholder="Search partners" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select className="h-8 rounded-full border border-border bg-card px-3 text-xs" value={role} onChange={(event) => setRole(event.target.value as PartnerRole | "")}>
        <option value="">All roles</option>
        {PARTNER_ROLES.map((item) => <option key={item} value={item}>{PARTNER_ROLE_CONFIG[item].label}</option>)}
      </select>
    </div>
  );

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading partners…</p>;
  if (error && partners.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive" role="alert">{error}</p>
        <button type="button" className="mt-3 text-xs underline" onClick={() => void refresh()}>Try again</button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="hidden md:block">{filters}</div>
        <button type="button" className="press h-8 rounded-full border border-border px-3 text-xs md:hidden" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="mr-1 inline size-3.5" />
          Filters
        </button>
        <Button type="button" size="sm" className="rounded-full" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-3.5" />
          New partner
        </Button>
      </div>
      {visible.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No external partners match.</p>}
      <div className="hidden overflow-hidden rounded-2xl bg-card shadow-card md:block">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="px-2 py-2 font-medium">Firm</th>
              <th className="px-2 py-2 font-medium">Contact</th>
              <th className="px-2 py-2 font-medium">On deals</th>
              <th className="px-2 py-2 font-medium">Last note</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((partner) => {
              const dealRoles = links.filter((link) => link.partner_id === partner.id).map((link) => link.role_on_deal);
              const chips = partnerChips({ type: partner.role, company: partner.company, roles: dealRoles, includeRoles: true });
              const typeChip = chips.filter((chip) => chip.kind === "type");
              const firmChip = chips.filter((chip) => chip.kind === "firm");
              const roleChips = chips.filter((chip) => chip.kind === "role");
              return (
                <tr key={partner.id} className="cursor-pointer border-t border-border hoverable:hover:bg-accent" onClick={() => open(partner.id)}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <PartnerAvatar name={partner.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-medium">{partner.name}</span>
                        <span className="text-xs text-muted-foreground">{partner.job_title || "—"}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-3">{typeChip.length > 0 ? <PartnerChipList chips={typeChip} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-3">{firmChip.length > 0 ? <PartnerChipList chips={firmChip} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-3 text-muted-foreground">{partner.email || partner.phone || "—"}</td>
                  <td className="px-2 py-3">
                    {dealRoles.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <PartnerChipList chips={roleChips} />
                        <span className="text-xs tabular-nums text-muted-foreground">{dealRoles.length}</span>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="max-w-48 truncate px-2 py-3 text-muted-foreground">{partner.notes || formatDate(partner.last_contacted, "d MMM yy")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 md:hidden">
        {visible.map((partner) => (
          <button key={partner.id} type="button" className="press rounded-2xl bg-card p-3.5 text-left shadow-card" onClick={() => open(partner.id)}>
            <PartnerSummary
              name={partner.name}
              subtitle={partner.job_title}
              type={partner.role}
              company={partner.company}
              dealRoles={links.filter((link) => link.partner_id === partner.id).map((link) => link.role_on_deal)}
            />
          </button>
        ))}
      </div>
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-4">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          {filters}
        </SheetContent>
      </Sheet>
      <Sheet open={!!selected} onOpenChange={(next) => !next && close()}>
        <SheetContent side="right" className="w-full overflow-auto p-0 transition-[transform] duration-300 ease-drawer sm:max-w-md">
          <SheetTitle className="sr-only">{selected?.name ?? "Partner"}</SheetTitle>
          {selected && (
            <PartnerDrawer
              partner={selected}
              deals={deals}
              links={links.filter((link) => link.partner_id === selected.id)}
              onEdit={() => { setEditing(selected); setDialogOpen(true); }}
              onDelete={async () => {
                if (!window.confirm(`Delete ${selected.name}?`)) return;
                const ok = await deletePartner(selected.id);
                if (ok) close();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
      <AddPartnerDialog
        open={dialogOpen}
        editPartner={editing}
        onClose={() => setDialogOpen(false)}
        onCreate={createPartner}
        onUpdate={updatePartner}
      />
    </div>
  );
}

function PartnerDrawer({
  partner,
  deals,
  links,
  onEdit,
  onDelete,
}: {
  partner: Partner;
  deals: { id: string; company_name: string; tier: keyof typeof TIER_CONFIG }[];
  links: { id: string; deal_id: string; role_on_deal: keyof typeof ROLE_ON_DEAL_LABEL }[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { refreshLinks, notify } = useCrm();
  const [notes, setNotes] = useState<PartnerNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dealQuery, setDealQuery] = useState("");
  const [role, setRole] = useState<RoleOnDeal>("advisor");

  useEffect(() => {
    let cancelled = false;
    supabase.from("partner_notes").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false }).then(({ data, error: fetchError }) => {
      if (cancelled) return;
      if (fetchError) setError(fetchError.message);
      else setNotes(data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [partner.id]);

  const addNote = async () => {
    const content = draft.trim();
    if (!content) return;
    const { data, error: insertError } = await supabase.from("partner_notes").insert({ partner_id: partner.id, content }).select().single();
    if (insertError || !data) {
      setError(insertError?.message || "Couldn't add this note.");
      return;
    }
    setDraft("");
    setNotes((current) => [data, ...current]);
  };

  const matches = deals.filter((deal) => !links.some((link) => link.deal_id === deal.id) && deal.company_name.toLowerCase().includes(dealQuery.trim().toLowerCase())).slice(0, 6);

  const linkDeal = async (dealId: string) => {
    const { error: insertError } = await supabase.from("deal_partners").insert({ deal_id: dealId, partner_id: partner.id, role_on_deal: role });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDealQuery("");
    notify("Deal linked");
    await refreshLinks();
  };

  const setLinkRole = async (id: string, role_on_deal: RoleOnDeal) => {
    const { error: updateError } = await supabase.from("deal_partners").update({ role_on_deal }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    notify("Role saved");
    await refreshLinks();
  };

  const unlink = async (id: string) => {
    const { error: deleteError } = await supabase.from("deal_partners").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    notify("Link removed");
    await refreshLinks();
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start gap-3 pr-8">
        <PartnerAvatar name={partner.name} size="lg" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.03em]">{partner.name}</h2>
          <p className="text-sm text-muted-foreground">{partner.job_title || "External contact"}</p>
          <div className="mt-2">
            <PartnerTags
              type={partner.role}
              company={partner.company}
              dealRoles={links.map((link) => link.role_on_deal)}
            />
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Email" value={partner.email} />
        <Info label="Phone" value={partner.phone} />
        <Info label="Region" value={partner.region_focus} />
        <Info label="Last contacted" value={formatDate(partner.last_contacted)} />
        <Info label="LinkedIn" value={partner.linkedin} />
        <Info label="Sectors" value={(partner.sector_focus || []).join(", ")} />
      </dl>
      {partner.description && <p className="text-sm text-muted-foreground">{partner.description}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>Edit</Button>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete}>Delete</Button>
      </div>
      <section>
        <h3 className="text-sm font-semibold">Linked deals</h3>
        <div className="mt-2 flex gap-2">
          <input className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm" value={dealQuery} placeholder="Link to deal" onChange={(event) => setDealQuery(event.target.value)} />
          <select className="h-9 rounded-lg border border-border bg-background px-2 text-xs" value={role} onChange={(event) => setRole(event.target.value as RoleOnDeal)}>
            {ROLES_ON_DEAL.map((item) => <option key={item} value={item}>{ROLE_ON_DEAL_LABEL[item]}</option>)}
          </select>
        </div>
        {dealQuery && (
          <ul className="mt-2 overflow-hidden rounded-xl border border-border">
            {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No matching deal.</li>}
            {matches.map((deal) => (
              <li key={deal.id}>
                <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hoverable:hover:bg-accent" onClick={() => void linkDeal(deal.id)}>
                  <span>{deal.company_name}</span>
                  <span className="text-xs text-muted-foreground">{TIER_CONFIG[deal.tier].label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-2 space-y-2">
          {links.length === 0 && <li className="text-sm text-muted-foreground">No deals linked. Search above to add one.</li>}
          {links.map((link) => {
            const deal = deals.find((item) => item.id === link.deal_id);
            if (!deal) return null;
            return (
              <li key={link.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-secondary px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{deal.company_name}</span>
                <select
                  aria-label={`Role on ${deal.company_name}`}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                  value={link.role_on_deal}
                  onChange={(event) => void setLinkRole(link.id, event.target.value as RoleOnDeal)}
                >
                  {ROLES_ON_DEAL.map((item) => <option key={item} value={item}>{ROLE_ON_DEAL_LABEL[item]}</option>)}
                </select>
                <button type="button" className="shrink-0 text-xs font-medium text-destructive" onClick={() => void unlink(link.id)}>Remove</button>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h3 className="text-sm font-semibold">Notes</h3>
        {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
        <div className="mt-2 flex gap-2">
          <input className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm" value={draft} placeholder="Add a note" onChange={(event) => setDraft(event.target.value)} />
          <Button type="button" size="sm" onClick={addNote}>Add</Button>
        </div>
        <ul className="mt-3 space-y-2">
          {notes.length === 0 && partner.notes && (
            <li className="rounded-xl bg-secondary px-3 py-2 text-sm">{partner.notes}</li>
          )}
          {notes.length === 0 && !partner.notes && <li className="text-sm text-muted-foreground">No notes yet.</li>}
          {notes.map((item) => (
            <PartnerNoteRow
              key={item.id}
              note={item}
              onSave={async (content) => {
                const { data, error: updateError } = await supabase.from("partner_notes").update({ content }).eq("id", item.id).select().single();
                if (updateError || !data) {
                  setError(updateError?.message || "Couldn't save that note.");
                  return false;
                }
                setNotes((current) => current.map((row) => (row.id === item.id ? data : row)));
                return true;
              }}
              onDelete={async () => {
                if (!window.confirm("Delete this note?")) return;
                const { error: deleteError } = await supabase.from("partner_notes").delete().eq("id", item.id);
                if (deleteError) {
                  setError(deleteError.message);
                  return;
                }
                setNotes((current) => current.filter((row) => row.id !== item.id));
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PartnerNoteRow({
  note,
  onSave,
  onDelete,
}: {
  note: PartnerNote;
  onSave: (content: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const next = draft.trim();
    if (!next || next === note.content) {
      setDraft(note.content);
      setEditing(false);
      return;
    }
    setBusy(true);
    const ok = await onSave(next);
    setBusy(false);
    if (ok) setEditing(false);
  };

  return (
    <li className="rounded-xl bg-secondary px-3 py-2">
      {editing ? (
        <>
          <textarea
            aria-label="Edit note"
            className="min-h-16 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus-visible:shadow-focus"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setDraft(note.content); setEditing(false); }}>Cancel</Button>
            <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={() => void save()}>Save</Button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm">{note.content}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">{formatDate(note.created_at, "d MMM yyyy, HH:mm")}</p>
            <div className="flex shrink-0">
              <button type="button" className="press grid size-7 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent" aria-label="Edit note" onClick={() => { setDraft(note.content); setEditing(true); }}>
                <Pencil className="size-3.5" />
              </button>
              <button type="button" className="press grid size-7 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent" aria-label="Delete note" onClick={onDelete}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate">{value || "—"}</dd>
    </div>
  );
}
