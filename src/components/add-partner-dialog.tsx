"use client";

import { useState } from "react";
import { DateField } from "@/components/task-dates";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PARTNER_ROLE_CONFIG, PARTNER_ROLES } from "@/lib/constants";
import type { Partner, PartnerRole } from "@/types/database";

const field = "mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:shadow-focus";

interface AddPartnerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (partner: Partial<Partner> & { name: string; role: PartnerRole }) => Promise<boolean>;
  editPartner?: Partner | null;
  onUpdate?: (id: string, updates: Partial<Partner>) => Promise<boolean>;
}

const empty = {
  name: "",
  role: "advisors" as PartnerRole,
  job_title: "",
  company: "",
  description: "",
  email: "",
  phone: "",
  linkedin: "",
  region_focus: "",
  sector_focus: "",
  notes: "",
  last_contacted: "",
};

function formFromPartner(partner: Partner | null | undefined) {
  if (!partner) return empty;
  return {
    name: partner.name,
    role: partner.role,
    job_title: partner.job_title || "",
    company: partner.company || "",
    description: partner.description || "",
    email: partner.email || "",
    phone: partner.phone || "",
    linkedin: partner.linkedin || "",
    region_focus: partner.region_focus || "",
    sector_focus: (partner.sector_focus || []).join(", "),
    notes: partner.notes || "",
    last_contacted: partner.last_contacted || "",
  };
}

export function AddPartnerDialog({ open, onClose, onCreate, editPartner, onUpdate }: AddPartnerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-[520px]">
        {open && (
          <PartnerForm
            key={editPartner?.id ?? "new"}
            editPartner={editPartner}
            onClose={onClose}
            onCreate={onCreate}
            onUpdate={onUpdate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PartnerForm({ editPartner, onClose, onCreate, onUpdate }: Omit<AddPartnerDialogProps, "open">) {
  const [form, setForm] = useState(() => formFromPartner(editPartner));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = !!editPartner;

  const set = (key: keyof typeof empty, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setFormError(null);
    const data: Partial<Partner> & { name: string; role: PartnerRole } = {
      name: form.name.trim(),
      role: form.role,
      job_title: form.job_title.trim() || null,
      company: form.company.trim() || null,
      description: form.description.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      linkedin: form.linkedin.trim() || null,
      region_focus: form.region_focus.trim() || null,
      sector_focus: form.sector_focus.split(",").map((item) => item.trim()).filter(Boolean),
      notes: form.notes.trim() || null,
      last_contacted: form.last_contacted || null,
    };
    const saved = isEdit && onUpdate ? await onUpdate(editPartner.id, data) : await onCreate(data);
    setSaving(false);
    if (!saved) {
      setFormError("Couldn't save this partner.");
      return;
    }
    onClose();
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit partner" : "Add partner"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Name
            <input className={field} value={form.name} onChange={(event) => set("name", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Role
            <select className={field} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as PartnerRole }))}>
              {PARTNER_ROLES.map((item) => <option key={item} value={item}>{PARTNER_ROLE_CONFIG[item].label}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Job title
            <input className={field} value={form.job_title} onChange={(event) => set("job_title", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Company
            <input className={field} value={form.company} onChange={(event) => set("company", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground sm:col-span-2">Description
            <textarea className={`${field} min-h-16 py-2`} value={form.description} onChange={(event) => set("description", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Email
            <input className={field} value={form.email} onChange={(event) => set("email", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Phone
            <input className={field} value={form.phone} onChange={(event) => set("phone", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">LinkedIn
            <input className={field} value={form.linkedin} onChange={(event) => set("linkedin", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Region
            <input className={field} value={form.region_focus} onChange={(event) => set("region_focus", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground sm:col-span-2">Sector focus
            <input className={field} value={form.sector_focus} placeholder="Healthcare, Logistics" onChange={(event) => set("sector_focus", event.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Last contacted
            <div className="mt-1">
              <DateField label="Last contacted" value={form.last_contacted || null} onChange={(value) => set("last_contacted", value || "")} />
            </div>
          </label>
          <label className="text-xs text-muted-foreground sm:col-span-2">Notes
            <textarea className={`${field} min-h-16 py-2`} value={form.notes} onChange={(event) => set("notes", event.target.value)} />
          </label>
        </div>
        {formError && <p className="text-xs text-destructive" role="alert">{formError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!form.name.trim() || saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
    </>
  );
}
