import { randomUUID } from "node:crypto";
import { topSortOrderForBoard } from "@/lib/kanban-order";
import type { DealTier } from "@/types/database";

type Row = Record<string, unknown> & { id: string };
type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export type AuditEntry = {
  id: string;
  table_name: string;
  row_id: string;
  action: AuditAction;
  created_at: string;
  old_values: Row | null;
  new_values: Row | null;
  source: "claude" | "web" | null;
  actor_label: string | null;
};

const ACTIVE: DealTier[] = ["active_tier_1", "active_tier_2", "pipeline"];

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryStore {
  actor: string | null = null;
  source: "claude" | "web" | null = "claude";
  deals: Row[] = [];
  activities: Row[] = [];
  history: Row[] = [];
  workstreams: Row[] = [];
  tasks: Row[] = [];
  partners: Row[] = [];
  links: Row[] = [];
  audits: AuditEntry[] = [];

  private write(table: string, rows: Row[], action: AuditAction, before: Row | null, after: Row | null) {
    const entry: AuditEntry = {
      id: randomUUID(),
      table_name: table,
      row_id: (after ?? before)!.id,
      action,
      created_at: new Date().toISOString(),
      old_values: before ? clone(before) : null,
      new_values: after ? clone(after) : null,
      source: this.source,
      actor_label: this.actor,
    };
    this.audits.unshift(entry);
    if (action === "INSERT" && after) rows.push(after);
    if (action === "UPDATE" && after) {
      const index = rows.findIndex((row) => row.id === after.id);
      if (index >= 0) rows[index] = after;
    }
    if (action === "DELETE" && before) {
      const index = rows.findIndex((row) => row.id === before.id);
      if (index >= 0) rows.splice(index, 1);
    }
    return entry.id;
  }

  private touchDeal(id: string, patch: Record<string, unknown>) {
    const current = this.deals.find((deal) => deal.id === id);
    if (!current) return null;
    const before = clone(current);
    const after = { ...current, ...patch, updated_at: new Date().toISOString() };
    if (patch.tier && patch.tier !== before.tier) {
      this.history.push({
        id: randomUUID(),
        deal_id: id,
        field: "tier",
        from_value: before.tier ?? null,
        to_value: patch.tier,
        changed_at: new Date().toISOString(),
        note: null,
      });
    }
    if (patch.deal_stage && patch.deal_stage !== before.deal_stage) {
      this.history.push({
        id: randomUUID(),
        deal_id: id,
        field: "stage",
        from_value: before.deal_stage ?? null,
        to_value: patch.deal_stage,
        changed_at: new Date().toISOString(),
        note: null,
      });
    }
    const auditId = this.write("deals", this.deals, "UPDATE", before, after);
    return { deal: clone(after), audit_id: auditId };
  }

  async searchDeals(filters: {
    query?: string;
    board?: string;
    stage?: string;
    sector?: string;
    isPassed?: boolean;
    archived?: boolean;
    includeAll?: boolean;
    limit: number;
  }) {
    const query = filters.query?.trim().toLowerCase();
    const sector = filters.sector?.trim().toLowerCase();
    return this.deals
      .filter((deal) => {
        if (!filters.includeAll) {
          const archived = Boolean(deal.archived);
          if (filters.archived === true && !archived) return false;
          if (filters.archived !== true && archived) return false;
        }
        if (filters.board && deal.tier !== filters.board) return false;
        if (filters.stage && deal.deal_stage !== filters.stage) return false;
        if (filters.isPassed != null && Boolean(deal.is_passed) !== filters.isPassed) return false;
        if (sector) {
          const hay = `${deal.sector ?? ""} ${deal.sector_group ?? ""} ${deal.industry ?? ""}`.toLowerCase();
          if (!hay.includes(sector)) return false;
        }
        if (query) {
          const hay = `${deal.company_name ?? ""} ${deal.legal_name ?? ""} ${deal.company_description ?? ""}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .slice(0, filters.limit)
      .map((deal) => ({
        id: deal.id,
        company_name: String(deal.company_name),
        legal_name: (deal.legal_name as string | null) ?? null,
        tier: String(deal.tier),
        deal_stage: (deal.deal_stage as string | null) ?? null,
        sector: (deal.sector as string | null) ?? null,
        sector_group: (deal.sector_group as string | null) ?? null,
        industry: (deal.industry as string | null) ?? null,
        country: (deal.country as string | null) ?? null,
        is_passed: Boolean(deal.is_passed),
        archived: Boolean(deal.archived),
        updated_at: (deal.updated_at as string | null) ?? null,
      }));
  }

  async getDeal(id: string) {
    const deal = this.deals.find((item) => item.id === id);
    if (!deal) return null;
    const workstreams = this.workstreams
      .filter((item) => item.deal_id === id)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((stream) => ({
        ...stream,
        tasks: this.tasks
          .filter((task) => task.workstream_id === stream.id)
          .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
      }));
    return {
      deal: clone(deal),
      activities: this.activities.filter((item) => item.deal_id === id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 15),
      stage_history: this.history.filter((item) => item.deal_id === id).sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at))).slice(0, 30),
      partners: this.links.filter((link) => link.deal_id === id).map((link) => {
        const partner = this.partners.find((item) => item.id === link.partner_id);
        return { ...link, name: partner?.name ?? null, partner_role: partner?.role ?? null };
      }),
      workstreams,
    };
  }

  async findDeals(query: string) {
    const needle = query.trim().toLowerCase();
    return this.deals
      .filter((deal) => `${deal.company_name ?? ""} ${deal.legal_name ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 20)
      .map((deal) => ({ id: deal.id, company_name: String(deal.company_name), legal_name: (deal.legal_name as string | null) ?? null }));
  }

  async nextSortOrder(tier: string) {
    return topSortOrderForBoard(
      this.deals.map((deal) => ({
        id: deal.id,
        tier: typeof deal.tier === "string" ? deal.tier : null,
        archived: deal.archived === true,
        sort_order: typeof deal.sort_order === "number" ? deal.sort_order : null,
      })),
      tier,
    );
  }

  async lastActiveBoard(dealId: string) {
    const matches = this.history.filter((item) => item.deal_id === dealId && item.field === "tier" && item.to_value === "passed");
    const row = matches.at(-1);
    if (!row || !ACTIVE.includes(row.from_value as DealTier)) return null;
    return String(row.from_value);
  }

  async createDeal(row: Record<string, unknown>) {
    const deal: Row = {
      id: randomUUID(),
      archived: false,
      is_passed: false,
      passed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...row,
    };
    const auditId = this.write("deals", this.deals, "INSERT", null, deal);
    if (deal.deal_stage) {
      this.history.push({
        id: randomUUID(),
        deal_id: deal.id,
        field: "stage",
        from_value: null,
        to_value: deal.deal_stage,
        changed_at: new Date().toISOString(),
        note: "Initial stage",
      });
    }
    return { deal: clone(deal), audit_id: auditId };
  }

  async updateDeal(id: string, patch: Record<string, unknown>) {
    return this.touchDeal(id, patch);
  }

  async addNote(dealId: string, content: string) {
    const activity: Row = { id: randomUUID(), deal_id: dealId, content, created_at: new Date().toISOString() };
    const auditId = this.write("deal_activities", this.activities, "INSERT", null, activity);
    return { activity: clone(activity), audit_id: auditId };
  }

  async listNextSteps(dealId: string) {
    const bundle = await this.getDeal(dealId);
    return bundle?.workstreams ?? [];
  }

  async addWorkstream(dealId: string, name: string) {
    const sort = this.workstreams.filter((item) => item.deal_id === dealId).length;
    const row: Row = { id: randomUUID(), deal_id: dealId, name, sort_order: sort, created_at: new Date().toISOString() };
    const auditId = this.write("deal_workstreams", this.workstreams, "INSERT", null, row);
    return { workstream: clone(row), audit_id: auditId };
  }

  async updateWorkstream(id: string, name: string) {
    const current = this.workstreams.find((item) => item.id === id);
    if (!current) return null;
    const after = { ...current, name };
    const auditId = this.write("deal_workstreams", this.workstreams, "UPDATE", current, after);
    return { workstream: clone(after), audit_id: auditId };
  }

  async addTask(row: Record<string, unknown>) {
    const stream = this.workstreams.find((item) => item.id === row.workstream_id);
    if (!stream || stream.deal_id !== row.deal_id) return null;
    const task: Row = {
      id: randomUUID(),
      status: "not_started",
      is_milestone: false,
      sort_order: this.tasks.filter((item) => item.workstream_id === row.workstream_id).length,
      created_at: new Date().toISOString(),
      ...row,
    };
    const auditId = this.write("deal_tasks", this.tasks, "INSERT", null, task);
    return { task: clone(task), audit_id: auditId };
  }

  async updateTask(id: string, patch: Record<string, unknown>) {
    const current = this.tasks.find((item) => item.id === id);
    if (!current) return null;
    const after = { ...current, ...patch };
    const auditId = this.write("deal_tasks", this.tasks, "UPDATE", current, after);
    return { task: clone(after), audit_id: auditId };
  }

  async listPartners(query: string | null, role: string | null = null) {
    const needle = query?.trim().toLowerCase();
    return this.partners
      .filter((partner) => !role || partner.role === role)
      .filter((partner) => !needle || `${partner.name} ${partner.company ?? ""} ${partner.role ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 50)
      .map((partner) => clone(partner));
  }

  async createPartner(row: Record<string, unknown>) {
    const partner: Row = { id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
    const auditId = this.write("partners", this.partners, "INSERT", null, partner);
    return { partner: clone(partner), audit_id: auditId };
  }

  async linkPartner(dealId: string, partnerId: string, role: string) {
    if (!this.deals.some((deal) => deal.id === dealId)) return { error: "No deal with that id." };
    if (!this.partners.some((partner) => partner.id === partnerId)) return { error: "No partner with that id." };
    const existing = this.links.find((link) => link.deal_id === dealId && link.partner_id === partnerId);
    if (existing) {
      const after = { ...existing, role_on_deal: role };
      const auditId = this.write("deal_partners", this.links, "UPDATE", existing, after);
      return { link: clone(after), audit_id: auditId, updated: true };
    }
    const link: Row = { id: randomUUID(), deal_id: dealId, partner_id: partnerId, role_on_deal: role, created_at: new Date().toISOString() };
    const auditId = this.write("deal_partners", this.links, "INSERT", null, link);
    return { link: clone(link), audit_id: auditId, updated: false };
  }

  async unlinkPartner(dealId: string, partnerId: string) {
    const existing = this.links.find((link) => link.deal_id === dealId && link.partner_id === partnerId);
    if (!existing) return null;
    const auditId = this.write("deal_partners", this.links, "DELETE", existing, null);
    return { audit_id: auditId };
  }

  async listRecentChanges(limit: number, claudeOnly: boolean) {
    const changes = this.audits.filter((entry) => !claudeOnly || entry.source === "claude").slice(0, limit);
    return { tagging_installed: true, changes };
  }

  async undo(auditId: string) {
    const entry = this.audits.find((item) => item.id === auditId);
    if (!entry) throw new Error("audit entry not found");
    if (entry.source !== "claude") throw new Error("only changes made via Claude can be undone");
    const table = this.table(entry.table_name);
    if (entry.action === "INSERT") {
      const row = table.find((item) => item.id === entry.row_id);
      if (!row) throw new Error("That row is already gone.");
      this.source = "web";
      this.write(entry.table_name, table, "DELETE", row, null);
      this.source = "claude";
      return { undone: true, reversal: "delete", table: entry.table_name, row_id: entry.row_id };
    }
    if (entry.action === "DELETE") {
      if (!entry.old_values) throw new Error("Nothing to restore.");
      if (table.some((item) => item.id === entry.row_id)) throw new Error("That row already exists.");
      this.source = "web";
      this.write(entry.table_name, table, "INSERT", null, clone(entry.old_values));
      this.source = "claude";
      return { undone: true, reversal: "insert", table: entry.table_name, row_id: entry.row_id };
    }
    const current = table.find((item) => item.id === entry.row_id);
    if (!current || !entry.old_values || !entry.new_values) throw new Error("That row is no longer there.");
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(entry.old_values)) {
      if (key === "id") continue;
      if (JSON.stringify(entry.old_values[key]) !== JSON.stringify(entry.new_values[key])) patch[key] = entry.old_values[key];
    }
    const after = { ...current, ...patch };
    this.source = "web";
    this.write(entry.table_name, table, "UPDATE", current, after);
    this.source = "claude";
    return { undone: true, reversal: "update", table: entry.table_name, row_id: entry.row_id, fields: Object.keys(patch) };
  }

  private table(name: string) {
    const tables: Record<string, Row[]> = {
      deals: this.deals,
      deal_activities: this.activities,
      deal_workstreams: this.workstreams,
      deal_tasks: this.tasks,
      partners: this.partners,
      deal_partners: this.links,
    };
    const rows = tables[name];
    if (!rows) throw new Error("this table cannot be undone");
    return rows;
  }
}

let shared: MemoryStore | null = null;

export function sharedMemoryStore() {
  if (!shared) shared = new MemoryStore();
  return shared;
}

export function resetSharedMemoryStore() {
  shared = new MemoryStore();
  return shared;
}
