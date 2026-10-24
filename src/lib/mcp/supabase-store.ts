import type { SupabaseClient } from "@supabase/supabase-js";
import { topSortOrder } from "@/lib/kanban-order";
import { CrmError } from "@/lib/mcp/deal-write";
import type { DealTier } from "@/types/database";

const ACTIVE: DealTier[] = ["active", "pipeline"];

/** History rows written before the board change may name a retired active board. */
function currentBoard(value: unknown): DealTier | null {
  const text = typeof value === "string" ? value : "";
  if (text === "active_tier_1" || text === "active_tier_2") return "active";
  return (ACTIVE as string[]).includes(text) ? (text as DealTier) : null;
}

function fail(error: { message: string } | null, fallback: string): never {
  throw new CrmError(error?.message || fallback);
}

async function latestAudit(db: SupabaseClient, table: string, rowId: string, action: string) {
  const { data, error } = await db
    .from("audit_log")
    .select("id")
    .eq("table_name", table)
    .eq("row_id", rowId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return (data?.[0]?.id as string | undefined) ?? null;
}

export class SupabaseStore {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
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
    let query = this.db
      .from("deals")
      .select("id, company_name, legal_name, tier, deal_stage, sector, sector_group, industry, country, is_passed, archived, updated_at, company_description")
      .order("updated_at", { ascending: false })
      .limit(filters.limit);
    if (!filters.includeAll) query = query.eq("archived", filters.archived === true);
    if (filters.board) query = query.eq("tier", filters.board);
    if (filters.stage) query = query.eq("deal_stage", filters.stage);
    if (filters.isPassed != null) query = query.eq("is_passed", filters.isPassed);
    const text = filters.query?.replace(/[%_,.()]/g, "").trim();
    const sector = filters.sector?.replace(/[%_,.()]/g, "").trim();
    if (text) {
      query = query.or(`company_name.ilike.%${text}%,legal_name.ilike.%${text}%,company_description.ilike.%${text}%`);
    } else if (sector) {
      query = query.or(`sector.ilike.%${sector}%,sector_group.ilike.%${sector}%,industry.ilike.%${sector}%`);
    }
    const { data, error } = await query;
    if (error) fail(error, "Couldn't search deals.");
    let rows = data ?? [];
    if (text && sector) {
      const needle = text.toLowerCase();
      const sectorNeedle = sector.toLowerCase();
      rows = rows.filter((deal) => {
        const hay = `${deal.company_name ?? ""} ${deal.legal_name ?? ""} ${deal.company_description ?? ""}`.toLowerCase();
        const sectorHay = `${deal.sector ?? ""} ${deal.sector_group ?? ""} ${deal.industry ?? ""}`.toLowerCase();
        return hay.includes(needle) && sectorHay.includes(sectorNeedle);
      });
    }
    return rows.map((deal) => ({
      id: deal.id as string,
      company_name: deal.company_name as string,
      legal_name: (deal.legal_name as string | null) ?? null,
      tier: deal.tier as string,
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
    const dealResult = await this.db.from("deals").select("*").eq("id", id).maybeSingle();
    if (dealResult.error) fail(dealResult.error, "Couldn't load that deal.");
    if (!dealResult.data) return null;
    const [activities, history, links, partners, workstreams, tasks] = await Promise.all([
      this.db.from("deal_activities").select("id, deal_id, content, created_at").eq("deal_id", id).order("created_at", { ascending: false }).limit(15),
      this.db.from("deal_stage_history").select("id, deal_id, field, from_value, to_value, changed_at, note").eq("deal_id", id).order("changed_at", { ascending: false }).limit(30),
      this.db.from("deal_partners").select("id, deal_id, partner_id, role_on_deal, created_at").eq("deal_id", id),
      this.db.from("partners").select("id, name, role, company"),
      this.db.from("deal_workstreams").select("id, deal_id, name, sort_order, created_at").eq("deal_id", id).order("sort_order"),
      this.db.from("deal_tasks").select("*").eq("deal_id", id).order("sort_order"),
    ]);
    const failed = [activities, history, links, partners, workstreams, tasks].find((result) => result.error);
    if (failed?.error) fail(failed.error, "Couldn't load the deal's related records.");
    const partnerById = new Map((partners.data ?? []).map((partner) => [partner.id, partner]));
    const tasksByStream = new Map<string, Record<string, unknown>[]>();
    for (const task of tasks.data ?? []) {
      const list = tasksByStream.get(task.workstream_id) ?? [];
      list.push(task);
      tasksByStream.set(task.workstream_id, list);
    }
    return {
      deal: dealResult.data as Record<string, unknown>,
      activities: activities.data ?? [],
      stage_history: history.data ?? [],
      partners: (links.data ?? []).map((link) => {
        const partner = partnerById.get(link.partner_id);
        return { ...link, name: partner?.name ?? null, partner_role: partner?.role ?? null };
      }),
      workstreams: (workstreams.data ?? []).map((stream) => ({ ...stream, tasks: tasksByStream.get(stream.id) ?? [] })),
    };
  }

  async findDeals(query: string) {
    const needle = query.replace(/[%_,.()]/g, "").trim();
    if (!needle) return [];
    const { data, error } = await this.db
      .from("deals")
      .select("id, company_name, legal_name")
      .or(`company_name.ilike.%${needle}%,legal_name.ilike.%${needle}%`)
      .limit(20);
    if (error) fail(error, "Couldn't look up that deal.");
    return (data ?? []).map((deal) => ({
      id: deal.id as string,
      company_name: deal.company_name as string,
      legal_name: (deal.legal_name as string | null) ?? null,
    }));
  }

  async nextSortOrder(tier: string) {
    const { data, error } = await this.db
      .from("deals")
      .select("sort_order")
      .eq("tier", tier)
      .or("archived.is.null,archived.eq.false")
      .order("sort_order", { ascending: true })
      .limit(1);
    if (error) fail(error, "Couldn't place the deal on the board.");
    const raw = data?.[0]?.sort_order;
    const value = typeof raw === "number" ? raw : Number(raw);
    return topSortOrder(raw != null && Number.isFinite(value) ? [value] : []);
  }

  async lastActiveBoard(dealId: string) {
    const { data, error } = await this.db
      .from("deal_stage_history")
      .select("from_value")
      .eq("deal_id", dealId)
      .eq("field", "tier")
      .eq("to_value", "passed")
      .order("changed_at", { ascending: false })
      .limit(1);
    if (error) return null;
    const from = data?.[0]?.from_value as string | undefined;
    return currentBoard(from);
  }

  async createDeal(row: Record<string, unknown>) {
    const { data, error } = await this.db.from("deals").insert(row).select("*").single();
    if (error || !data) fail(error, "Couldn't create the deal.");
    return { deal: data as Record<string, unknown>, audit_id: await latestAudit(this.db, "deals", data.id, "INSERT") };
  }

  async updateDeal(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.db.from("deals").update(patch).eq("id", id).select("*").maybeSingle();
    if (error) fail(error, "Couldn't update the deal.");
    if (!data) return null;
    return { deal: data as Record<string, unknown>, audit_id: await latestAudit(this.db, "deals", id, "UPDATE") };
  }

  async addNote(dealId: string, content: string) {
    const { data, error } = await this.db.from("deal_activities").insert({ deal_id: dealId, content }).select("*").single();
    if (error || !data) fail(error, "Couldn't add the note.");
    return { activity: data as Record<string, unknown>, audit_id: await latestAudit(this.db, "deal_activities", data.id, "INSERT") };
  }

  async listNextSteps(dealId: string) {
    const bundle = await this.getDeal(dealId);
    return bundle?.workstreams ?? [];
  }

  async addWorkstream(dealId: string, name: string) {
    const { count } = await this.db.from("deal_workstreams").select("id", { count: "exact", head: true }).eq("deal_id", dealId);
    const { data, error } = await this.db.from("deal_workstreams").insert({ deal_id: dealId, name, sort_order: count ?? 0 }).select("*").single();
    if (error || !data) fail(error, "Couldn't add the workstream.");
    return { workstream: data, audit_id: await latestAudit(this.db, "deal_workstreams", data.id, "INSERT") };
  }

  async updateWorkstream(id: string, name: string) {
    const { data, error } = await this.db.from("deal_workstreams").update({ name }).eq("id", id).select("*").maybeSingle();
    if (error) fail(error, "Couldn't rename the workstream.");
    if (!data) return null;
    return { workstream: data, audit_id: await latestAudit(this.db, "deal_workstreams", id, "UPDATE") };
  }

  async addTask(row: Record<string, unknown>) {
    const stream = await this.db.from("deal_workstreams").select("id, deal_id").eq("id", row.workstream_id).maybeSingle();
    if (stream.error) fail(stream.error, "Couldn't find that workstream.");
    if (!stream.data || stream.data.deal_id !== row.deal_id) return null;
    const { count } = await this.db.from("deal_tasks").select("id", { count: "exact", head: true }).eq("workstream_id", row.workstream_id);
    const { data, error } = await this.db.from("deal_tasks").insert({ status: "not_started", is_milestone: false, sort_order: count ?? 0, ...row }).select("*").single();
    if (error || !data) fail(error, "Couldn't add the task.");
    return { task: data, audit_id: await latestAudit(this.db, "deal_tasks", data.id, "INSERT") };
  }

  async updateTask(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.db.from("deal_tasks").update(patch).eq("id", id).select("*").maybeSingle();
    if (error) fail(error, "Couldn't update the task.");
    if (!data) return null;
    return { task: data, audit_id: await latestAudit(this.db, "deal_tasks", id, "UPDATE") };
  }

  async listPartners(query: string | null, role: string | null = null) {
    let request = this.db.from("partners").select("id, name, role, company, job_title, email, phone, region_focus, description").order("name").limit(50);
    const needle = query?.replace(/[%_,.()]/g, "").trim();
    if (needle) request = request.or(`name.ilike.%${needle}%,company.ilike.%${needle}%`);
    if (role) request = request.eq("role", role);
    const { data, error } = await request;
    if (error) fail(error, "Couldn't list partners.");
    return data ?? [];
  }

  async createPartner(row: Record<string, unknown>) {
    const { data, error } = await this.db.from("partners").insert(row).select("*").single();
    if (error || !data) fail(error, "Couldn't create the partner.");
    return { partner: data, audit_id: await latestAudit(this.db, "partners", data.id, "INSERT") };
  }

  async linkPartner(dealId: string, partnerId: string, role: string) {
    const existing = await this.db.from("deal_partners").select("*").eq("deal_id", dealId).eq("partner_id", partnerId).maybeSingle();
    if (existing.error) fail(existing.error, "Couldn't check the existing link.");
    if (existing.data) {
      const { data, error } = await this.db.from("deal_partners").update({ role_on_deal: role }).eq("id", existing.data.id).select("*").single();
      if (error || !data) fail(error, "Couldn't update the partner's role.");
      return { link: data, audit_id: await latestAudit(this.db, "deal_partners", data.id, "UPDATE"), updated: true };
    }
    const { data, error } = await this.db.from("deal_partners").insert({ deal_id: dealId, partner_id: partnerId, role_on_deal: role }).select("*").single();
    if (error || !data) fail(error, "Couldn't link the partner. Check that both ids exist.");
    return { link: data, audit_id: await latestAudit(this.db, "deal_partners", data.id, "INSERT"), updated: false };
  }

  async unlinkPartner(dealId: string, partnerId: string) {
    const existing = await this.db.from("deal_partners").select("id").eq("deal_id", dealId).eq("partner_id", partnerId).maybeSingle();
    if (existing.error) fail(existing.error, "Couldn't unlink the partner.");
    if (!existing.data) return null;
    const { error } = await this.db.from("deal_partners").delete().eq("id", existing.data.id);
    if (error) fail(error, "Couldn't unlink the partner.");
    return { audit_id: await latestAudit(this.db, "deal_partners", existing.data.id, "DELETE") };
  }

  async listRecentChanges(limit: number, claudeOnly: boolean) {
    const columns = "id, table_name, row_id, action, created_at, old_values, new_values, source, actor_label";
    let request = this.db.from("audit_log").select(columns).order("created_at", { ascending: false }).limit(limit);
    if (claudeOnly) request = request.eq("source", "claude");
    const first = await request;
    if (first.error && /source|actor_label|column/i.test(first.error.message)) {
      const fallback = await this.db
        .from("audit_log")
        .select("id, table_name, row_id, action, created_at, old_values, new_values")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (fallback.error) fail(fallback.error, "Couldn't read the audit log.");
      return { tagging_installed: false, changes: fallback.data ?? [] };
    }
    if (first.error) fail(first.error, "Couldn't read the audit log.");
    return { tagging_installed: true, changes: first.data ?? [] };
  }

  async undo(auditId: string) {
    const { data, error } = await this.db.rpc("undo_claude_change", { p_id: auditId });
    if (error) {
      if (error.code === "PGRST202" || /could not find the function|schema cache/i.test(error.message)) {
        throw new CrmError("Undo is not installed yet. Apply supabase/migrations/20261003160000_audit_source.sql, then try again.");
      }
      throw new CrmError(error.message);
    }
    return data as Record<string, unknown>;
  }
}
