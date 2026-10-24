import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  CrmError,
  PARTNER_ROLES,
  ROLES_ON_DEAL,
  TASK_STATUSES,
  buildCreateDeal,
  buildUpdateDeal,
  isUuid,
  optionalDate,
  optionalText,
  parseBoard,
  parsePartnerRole,
  parseRoleOnDeal,
  parseStage,
  parseTaskStatus,
  requireText,
} from "@/lib/mcp/deal-write";
import type { MemoryStore } from "@/lib/mcp/memory-store";
import { latestUpdateFromNote } from "@/lib/latest-update";
import { INDUSTRIES } from "@/lib/industries";
import { DEAL_STAGES, type Deal, type DealTier } from "@/types/database";

export type CrmStore = Pick<
  MemoryStore,
  | "searchDeals"
  | "getDeal"
  | "findDeals"
  | "nextSortOrder"
  | "lastActiveBoard"
  | "createDeal"
  | "updateDeal"
  | "addNote"
  | "listNextSteps"
  | "addWorkstream"
  | "updateWorkstream"
  | "addTask"
  | "updateTask"
  | "listPartners"
  | "createPartner"
  | "linkPartner"
  | "unlinkPartner"
  | "listRecentChanges"
  | "undo"
>;

const board = z.string().describe("Board: Active, Pipeline, or Passed / Out.");
const stage = z.string().describe(`Stage: ${DEAL_STAGES.filter((item) => item !== "Passed").join(", ")}. Do not use Passed; mark is_passed instead.`);

const dealRef = {
  deal_id: z.string().optional().describe("Deal UUID. Preferred when you have it."),
  deal: z.string().optional().describe("Deal name or codename, used when deal_id is omitted."),
};

function presentDeal(deal: Record<string, unknown>) {
  const copy = { ...deal };
  if (typeof copy.screening_raw_analysis === "string" && copy.screening_raw_analysis.length > 400) {
    copy.screening_raw_analysis = `${copy.screening_raw_analysis.slice(0, 400)}…`;
  }
  return copy;
}

async function resolveDeal(store: CrmStore, input: { deal_id?: string; deal?: string }) {
  if (input.deal_id) {
    if (!isUuid(input.deal_id)) throw new CrmError("deal_id must be a UUID. Call search_deals if you only have a name.");
    const bundle = await store.getDeal(input.deal_id);
    if (!bundle) throw new CrmError("No deal with that id.");
    return bundle.deal;
  }
  const query = input.deal?.trim();
  if (!query) throw new CrmError("Provide deal_id or deal (the name or codename).");
  const matches = await store.findDeals(query);
  const exact = matches.filter((deal) => {
    const name = deal.company_name.toLowerCase();
    const legal = (deal.legal_name ?? "").toLowerCase();
    const needle = query.toLowerCase();
    return name === needle || legal === needle;
  });
  const chosen = exact.length > 0 ? exact : matches;
  if (chosen.length === 0) throw new CrmError(`No deal matches "${query}".`);
  if (chosen.length > 1) {
    throw new CrmError(`Several deals match "${query}". Pass deal_id. ${chosen.map((deal) => `${deal.company_name} (${deal.id})`).join("; ")}`);
  }
  const bundle = await store.getDeal(chosen[0].id);
  if (!bundle) throw new CrmError("That deal disappeared before it could be loaded.");
  return bundle.deal;
}

function summarizeChange(entry: {
  id: string;
  table_name: string;
  row_id: string;
  action: string;
  created_at: string;
  source?: string | null;
  actor_label?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
}) {
  const next = entry.new_values ?? {};
  const prev = entry.old_values ?? {};
  const changed = entry.action === "UPDATE"
    ? Object.keys(next).filter((key) => key !== "updated_at" && JSON.stringify(next[key]) !== JSON.stringify(prev[key]))
    : [];
  const preview: Record<string, string> = {};
  const source = entry.action === "DELETE" ? prev : next;
  for (const key of ["company_name", "legal_name", "content", "title", "name", "role_on_deal", "tier", "deal_stage"]) {
    if (source[key] != null) preview[key] = String(source[key]).slice(0, 180);
  }
  return {
    audit_id: entry.id,
    table: entry.table_name,
    row_id: entry.row_id,
    action: entry.action,
    at: entry.created_at,
    source: entry.source ?? null,
    actor: entry.actor_label ?? null,
    changed_fields: changed,
    preview,
  };
}

async function writeLatestUpdate(store: CrmStore, dealId: string, content: string) {
  const submission = latestUpdateFromNote(content);
  if (!submission) throw new CrmError("Latest update can't be empty. The previous update stays until a new one is saved.");
  const created = await store.addNote(dealId, submission.content);
  const updated = await store.updateDeal(dealId, submission.patch);
  if (!updated) throw new CrmError("No deal with that id.");
  return { created, updated };
}

const handlers: Record<string, (store: CrmStore, raw: unknown) => Promise<unknown>> = {
  async search_deals(store, raw) {
    const input = z.object({
      query: z.string().max(200).optional().describe("Matches deal name, company, or description."),
      board: board.optional(),
      stage: stage.optional(),
      sector: z.string().max(200).optional().describe("Sub-sector, sector group, or industry."),
      is_passed: z.boolean().optional(),
      archived: z.boolean().optional().describe("true returns archived deals only. Omit for the live boards."),
      include_all: z.boolean().optional().describe("Include both archived and live deals."),
      limit: z.number().int().min(1).max(50).optional(),
    }).parse(raw);
    const boardValue = input.board ? parseBoard(input.board) : undefined;
    const stageValue = input.stage ? parseStage(input.stage) : undefined;
    const deals = await store.searchDeals({
      query: input.query,
      board: boardValue,
      stage: stageValue,
      sector: input.sector,
      isPassed: input.is_passed,
      archived: input.archived,
      includeAll: input.include_all,
      limit: input.limit ?? 25,
    });
    return { deals, count: deals.length };
  },

  async get_deal(store, raw) {
    const input = z.object(dealRef).parse(raw);
    const deal = await resolveDeal(store, input);
    const bundle = await store.getDeal(String(deal.id));
    if (!bundle) throw new CrmError("No deal with that id.");
    return {
      deal: presentDeal(bundle.deal),
      financials: {
        revenue: bundle.deal.latest_sales ?? null,
        ebitda: bundle.deal.latest_ebitda ?? null,
        net_debt: bundle.deal.net_debt_cash ?? null,
        sales_amount: bundle.deal.sales_amount ?? null,
        ebitda_amount: bundle.deal.ebitda_amount ?? null,
        net_debt_amount: bundle.deal.net_debt_amount ?? null,
        currency: bundle.deal.fin_currency ?? null,
        currency_assumed: bundle.deal.fin_currency_assumed ?? null,
        financial_year: bundle.deal.financial_year ?? null,
        enterprise_value: bundle.deal.enterprise_value ?? null,
      },
      stage_history: bundle.stage_history,
      partners: bundle.partners,
      workstreams: bundle.workstreams,
      notes: bundle.activities,
    };
  },

  async create_deal(store, raw) {
    const input = z.object({
      name: z.string().optional().describe("Deal name or codename, for example deal-1."),
      codename: z.string().optional(),
      company: z.string().optional().describe("Legal or trading company name."),
      sector: z.string().optional().describe("Free-text sub-sector."),
      industry: z.string().optional().describe("Fixed industry from the EnterpriseSG list, plus Education, Consumer & Lifestyle, Hospitality & Tourism, and Financial Services & Real Estate."),
      country: z.string().optional(),
      description: z.string().optional(),
      source: z.string().optional(),
      source_type: z.string().optional(),
      source_contact: z.string().optional(),
      owners: z.string().optional().describe("Deal lead."),
      revenue: z.union([z.string(), z.number()]).optional(),
      ebitda: z.union([z.string(), z.number()]).optional(),
      net_debt: z.union([z.string(), z.number()]).optional(),
      currency: z.string().optional().describe("ISO code used when an amount is a bare number, for example SGD."),
      financial_year: z.string().optional(),
      enterprise_value: z.union([z.string(), z.number()]).optional(),
      transaction_type: z.string().optional(),
      stake_percent: z.number().optional(),
      ticket_size: z.string().optional(),
      vendor: z.string().optional(),
      board: board.optional().describe("Defaults to Pipeline."),
      stage: stage.optional().describe("Defaults to Screening/Pipeline."),
      latest_context: z.string().optional(),
      other_info: z.string().optional(),
    }).parse(raw);
    const tier = input.board ? parseBoard(input.board) : "pipeline";
    const sort = await store.nextSortOrder(tier);
    const row = buildCreateDeal(input, sort);
    const created = await store.createDeal(row);
    return {
      deal: presentDeal(created.deal),
      audit_id: created.audit_id,
      message: `Created ${created.deal.company_name} on ${created.deal.tier}. Undo with undo_change if this was wrong.`,
    };
  },

  async update_deal(store, raw) {
    const input = z.object({
      ...dealRef,
      name: z.string().optional(),
      company: z.string().optional(),
      sector: z.string().optional().describe("Free-text sub-sector."),
      industry: z.string().optional().describe("Fixed industry from the EnterpriseSG list, plus Education, Consumer & Lifestyle, Hospitality & Tourism, and Financial Services & Real Estate."),
      country: z.string().optional(),
      description: z.string().optional(),
      source: z.string().optional(),
      owners: z.string().optional(),
      revenue: z.union([z.string(), z.number()]).optional(),
      ebitda: z.union([z.string(), z.number()]).optional(),
      net_debt: z.union([z.string(), z.number()]).optional(),
      currency: z.string().optional(),
      financial_year: z.string().optional(),
      enterprise_value: z.union([z.string(), z.number()]).optional(),
      transaction_type: z.string().optional(),
      stake_percent: z.number().optional(),
      ticket_size: z.string().optional(),
      vendor: z.string().optional(),
      board: board.optional(),
      stage: stage.optional(),
      is_passed: z.boolean().optional().describe("true moves the deal to Passed / Out and keeps its stage. false restores an active board."),
      passed_reason: z.string().optional(),
      archived: z.boolean().optional().describe("Archive or unarchive. There is no delete."),
      latest_context: z.string().optional(),
      other_info: z.string().optional(),
      target_completion_date: z.string().optional(),
      exclusivity_end_date: z.string().optional(),
      latest_update: z.string().max(8000).optional().describe("Newest update. Logged as a note and stored on the deal. Empty text is rejected."),
    }).parse(raw);
    const current = (await resolveDeal(store, input)) as unknown as Deal;
    const restore = input.is_passed === false ? (await store.lastActiveBoard(current.id) as DealTier | null) : null;
    const { latest_update: latestUpdateInput, ...fields } = input;
    const hasDealFields = Object.entries(fields).some(([key, value]) => key !== "deal_id" && key !== "deal" && value !== undefined);
    let latestText: string | null = null;
    if (latestUpdateInput !== undefined) {
      latestText = optionalText(latestUpdateInput, 8000, "Latest update");
      if (!latestText) throw new CrmError("Latest update can't be empty. The previous update stays until a new one is saved.");
    }
    if (!hasDealFields && !latestText) throw new CrmError("No fields to update.");

    let updated: { deal: Record<string, unknown>; audit_id: string } | null = null;
    let noteAuditId: string | undefined;
    if (hasDealFields) {
      const patch = buildUpdateDeal(current, fields, restore);
      if (patch.tier && patch.tier !== current.tier) {
        patch.sort_order = await store.nextSortOrder(patch.tier);
      }
      updated = await store.updateDeal(current.id, patch);
      if (!updated) throw new CrmError("No deal with that id.");
    }
    if (latestText) {
      const logged = await writeLatestUpdate(store, String(current.id), latestText);
      noteAuditId = logged.created.audit_id;
      updated = logged.updated;
    }
    if (!updated) throw new CrmError("No deal with that id.");
    return {
      deal: presentDeal(updated.deal),
      audit_id: updated.audit_id,
      ...(noteAuditId ? { note_audit_id: noteAuditId } : {}),
    };
  },

  async add_deal_note(store, raw) {
    const input = z.object({ ...dealRef, note: z.string().min(1).max(8000) }).parse(raw);
    const deal = await resolveDeal(store, input);
    const content = requireText(input.note, 8000, "Note");
    const logged = await writeLatestUpdate(store, String(deal.id), content);
    return { activity: logged.created.activity, audit_id: logged.created.audit_id };
  },

  async list_next_steps(store, raw) {
    const input = z.object(dealRef).parse(raw);
    const deal = await resolveDeal(store, input);
    const workstreams = await store.listNextSteps(String(deal.id));
    return { deal_id: deal.id, deal: deal.company_name, workstreams };
  },

  async add_workstream(store, raw) {
    const input = z.object({ ...dealRef, name: z.string().min(1).max(160) }).parse(raw);
    const deal = await resolveDeal(store, input);
    const created = await store.addWorkstream(String(deal.id), requireText(input.name, 160, "Workstream name"));
    return created;
  },

  async update_workstream(store, raw) {
    const input = z.object({ workstream_id: z.string(), name: z.string().min(1).max(160) }).parse(raw);
    if (!isUuid(input.workstream_id)) throw new CrmError("workstream_id must be a UUID.");
    const updated = await store.updateWorkstream(input.workstream_id, requireText(input.name, 160, "Workstream name"));
    if (!updated) throw new CrmError("No workstream with that id.");
    return updated;
  },

  async add_task(store, raw) {
    const input = z.object({
      ...dealRef,
      workstream_id: z.string().optional(),
      workstream: z.string().optional().describe("Workstream name, if you do not have its id."),
      title: z.string().min(1).max(200),
      owner: z.string().max(80).optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      status: z.string().optional(),
      milestone: z.boolean().optional(),
      comment: z.string().max(2000).optional(),
    }).parse(raw);
    const deal = await resolveDeal(store, input);
    const steps = await store.listNextSteps(String(deal.id));
    let workstreamId = input.workstream_id;
    if (!workstreamId && input.workstream) {
      const match = steps.filter((stream) => String("name" in stream ? stream.name : "").toLowerCase() === input.workstream!.trim().toLowerCase());
      if (match.length !== 1) throw new CrmError(match.length === 0 ? "No workstream with that name. Call list_next_steps." : "More than one workstream has that name. Pass workstream_id.");
      workstreamId = String(match[0].id);
    }
    if (!workstreamId || !isUuid(workstreamId)) throw new CrmError("Provide workstream_id or workstream name.");
    const created = await store.addTask({
      workstream_id: workstreamId,
      deal_id: deal.id,
      title: requireText(input.title, 200, "Task title"),
      owner: optionalText(input.owner, 80, "Owner"),
      start_date: optionalDate(input.start_date, "Start date"),
      end_date: optionalDate(input.end_date, "End date"),
      status: input.status ? parseTaskStatus(input.status) : "not_started",
      is_milestone: Boolean(input.milestone),
      comment: optionalText(input.comment, 2000, "Comment"),
    });
    if (!created) throw new CrmError("That workstream is not on this deal.");
    return created;
  },

  async update_task(store, raw) {
    const input = z.object({
      task_id: z.string(),
      title: z.string().max(200).optional(),
      owner: z.string().max(80).nullable().optional(),
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      status: z.string().optional(),
      milestone: z.boolean().optional(),
      comment: z.string().max(2000).nullable().optional(),
    }).parse(raw);
    if (!isUuid(input.task_id)) throw new CrmError("task_id must be a UUID.");
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = requireText(input.title, 200, "Task title");
    if (input.owner !== undefined) patch.owner = optionalText(input.owner, 80, "Owner");
    if (input.start_date !== undefined) patch.start_date = optionalDate(input.start_date, "Start date");
    if (input.end_date !== undefined) patch.end_date = optionalDate(input.end_date, "End date");
    if (input.status !== undefined) patch.status = parseTaskStatus(input.status);
    if (input.milestone !== undefined) patch.is_milestone = input.milestone;
    if (input.comment !== undefined) patch.comment = optionalText(input.comment, 2000, "Comment");
    if (Object.keys(patch).length === 0) throw new CrmError("No task fields to update.");
    const updated = await store.updateTask(input.task_id, patch);
    if (!updated) throw new CrmError("No task with that id.");
    return updated;
  },

  async complete_task(store, raw) {
    const input = z.object({
      task_id: z.string(),
      comment: z.string().max(2000).optional(),
    }).parse(raw);
    if (!isUuid(input.task_id)) throw new CrmError("task_id must be a UUID.");
    const patch: Record<string, unknown> = { status: "done" };
    if (input.comment !== undefined) patch.comment = optionalText(input.comment, 2000, "Comment");
    const updated = await store.updateTask(input.task_id, patch);
    if (!updated) throw new CrmError("No task with that id.");
    return updated;
  },

  async list_partners(store, raw) {
    const input = z.object({
      query: z.string().max(200).optional(),
      role: z.string().optional().describe(`Optional partner type. One of: ${PARTNER_ROLES.join(", ")}.`),
    }).parse(raw ?? {});
    const partners = await store.listPartners(input.query ?? null, input.role ? parsePartnerRole(input.role) : null);
    return { partners, count: partners.length };
  },

  async create_partner(store, raw) {
    const input = z.object({
      name: z.string().min(1).max(200),
      role: z.string().describe(`One of: ${PARTNER_ROLES.join(", ")}.`),
      company: z.string().max(200).optional(),
      job_title: z.string().max(200).optional(),
      email: z.string().max(200).optional(),
      phone: z.string().max(80).optional(),
      region_focus: z.string().max(200).optional(),
      description: z.string().max(4000).optional(),
      notes: z.string().max(4000).optional(),
      linkedin: z.string().max(300).optional(),
    }).parse(raw);
    const created = await store.createPartner({
      name: requireText(input.name, 200, "Partner name"),
      role: parsePartnerRole(input.role),
      company: optionalText(input.company, 200, "Company"),
      job_title: optionalText(input.job_title, 200, "Job title"),
      email: optionalText(input.email, 200, "Email"),
      phone: optionalText(input.phone, 80, "Phone"),
      region_focus: optionalText(input.region_focus, 200, "Region"),
      description: optionalText(input.description, 4000, "Description"),
      notes: optionalText(input.notes, 4000, "Notes"),
      linkedin: optionalText(input.linkedin, 300, "LinkedIn"),
    });
    return created;
  },

  async link_partner_to_deal(store, raw) {
    const input = z.object({
      ...dealRef,
      partner_id: z.string(),
      role: z.string().describe(`Role on this deal: ${ROLES_ON_DEAL.join(", ")}.`),
    }).parse(raw);
    if (!isUuid(input.partner_id)) throw new CrmError("partner_id must be a UUID. Call list_partners.");
    const deal = await resolveDeal(store, input);
    const linked = await store.linkPartner(String(deal.id), input.partner_id, parseRoleOnDeal(input.role));
    if ("error" in linked && linked.error) throw new CrmError(String(linked.error));
    return linked;
  },

  async unlink_partner_from_deal(store, raw) {
    const input = z.object({ ...dealRef, partner_id: z.string() }).parse(raw);
    if (!isUuid(input.partner_id)) throw new CrmError("partner_id must be a UUID.");
    const deal = await resolveDeal(store, input);
    const removed = await store.unlinkPartner(String(deal.id), input.partner_id);
    if (!removed) throw new CrmError("That partner is not linked to this deal.");
    return { unlinked: true, ...removed };
  },

  async list_recent_changes(store, raw) {
    const input = z.object({
      limit: z.number().int().min(1).max(50).optional(),
      claude_only: z.boolean().optional().describe("Defaults to true. Set false to include every audit row."),
    }).parse(raw ?? {});
    const result = await store.listRecentChanges(input.limit ?? 20, input.claude_only !== false);
    return {
      tagging_installed: result.tagging_installed,
      changes: result.changes.map((entry) => summarizeChange(entry as Parameters<typeof summarizeChange>[0])),
    };
  },

  async undo_change(store, raw) {
    const input = z.object({
      audit_id: z.string().describe("audit_id from a Claude write or from list_recent_changes."),
    }).parse(raw);
    if (!isUuid(input.audit_id)) throw new CrmError("audit_id must be a UUID.");
    const result = await store.undo(input.audit_id);
    return result;
  },
};

export const CRM_TOOL_NAMES = Object.keys(handlers);

const descriptions: Record<string, string> = {
  search_deals: "Search deals by name, board, stage, sub-sector, industry, passed state, or archived. Does not change data.",
  get_deal: "Load one deal, including financials, stage history, partners and roles, workstreams and tasks, and recent notes.",
  create_deal: "Create a screened deal from a teaser or IM. Defaults to the Pipeline board and Screening/Pipeline stage. Writes the text financials and the derived numeric columns. industry is exactly one Industry. sector is the freeform Sub-sector. Returns audit_id for undo.",
  update_deal: "Patch a deal. industry is exactly one Industry. sector is the freeform Sub-sector. Setting is_passed true moves it to Passed / Out and keeps the stage. Setting is_passed false restores the previous active board, or Pipeline. Use archived to file a deal away. There is no delete. latest_update, when set, is also logged as a note, the same way the deal page composer does. An empty latest_update is rejected and does not clear the previous one.",
  add_deal_note: "Add a note on a deal and store that text as the latest update. Same result as saving the deal page's latest-update composer.",
  list_next_steps: "List workstreams and tasks (the Gantt next steps) for a deal.",
  add_workstream: "Add a workstream to a deal.",
  update_workstream: "Rename a workstream.",
  add_task: "Add a task to a workstream. Include owner, start and end dates, status, and milestone when you know them.",
  update_task: "Update a task's name, owner, dates, status, milestone, or comment.",
  complete_task: "Mark a task done. Use this when a step such as SPA signed is finished.",
  list_partners: `List people and firms in the partner database. Optional name or company query. Optional role filter, one of: ${PARTNER_ROLES.join(", ")}.`,
  create_partner: `Create a partner. Role is one of: ${PARTNER_ROLES.join(", ")}.`,
  link_partner_to_deal: "Link a partner to a deal with a role. Linking again updates the role.",
  unlink_partner_from_deal: "Remove a partner's link to a deal. Does not delete the partner.",
  list_recent_changes: "Recent audit log rows. Defaults to changes made via Claude, which can be undone.",
  undo_change: "Revert one Claude change by audit id. Updates restore the previous field values. Inserts are deleted. Only rows tagged via Claude can be undone.",
};

const schemas: Record<string, z.ZodType> = {
  search_deals: z.object({
    query: z.string().max(200).optional(),
    board: z.string().optional(),
    stage: z.string().optional(),
    sector: z.string().max(200).optional(),
    is_passed: z.boolean().optional(),
    archived: z.boolean().optional(),
    include_all: z.boolean().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  get_deal: z.object(dealRef),
  create_deal: z.object({
    name: z.string().optional(),
    codename: z.string().optional(),
    company: z.string().optional(),
    sector: z.string().optional().describe("Freeform Sub-sector."),
    industry: z.string().optional().describe(`Exactly one required, from: ${INDUSTRIES.join(", ")}.`),
    country: z.string().optional(),
    description: z.string().optional(),
    source: z.string().optional(),
    source_type: z.string().optional(),
    source_contact: z.string().optional(),
    owners: z.string().optional(),
    revenue: z.union([z.string(), z.number()]).optional(),
    ebitda: z.union([z.string(), z.number()]).optional(),
    net_debt: z.union([z.string(), z.number()]).optional(),
    currency: z.string().optional(),
    financial_year: z.string().optional(),
    enterprise_value: z.union([z.string(), z.number()]).optional(),
    transaction_type: z.string().optional(),
    stake_percent: z.number().optional(),
    ticket_size: z.string().optional(),
    vendor: z.string().optional(),
    board: z.string().optional(),
    stage: z.string().optional(),
    latest_context: z.string().optional(),
    other_info: z.string().optional(),
  }),
  update_deal: z.object({
    deal_id: z.string().optional(),
    deal: z.string().optional(),
    name: z.string().optional(),
    company: z.string().optional(),
    sector: z.string().optional().describe("Freeform Sub-sector."),
    industry: z.string().optional().describe(`Exactly one required, from: ${INDUSTRIES.join(", ")}.`),
    country: z.string().optional(),
    description: z.string().optional(),
    source: z.string().optional(),
    owners: z.string().optional(),
    revenue: z.union([z.string(), z.number()]).optional(),
    ebitda: z.union([z.string(), z.number()]).optional(),
    net_debt: z.union([z.string(), z.number()]).optional(),
    currency: z.string().optional(),
    financial_year: z.string().optional(),
    enterprise_value: z.union([z.string(), z.number()]).optional(),
    transaction_type: z.string().optional(),
    stake_percent: z.number().optional(),
    ticket_size: z.string().optional(),
    vendor: z.string().optional(),
    board: z.string().optional(),
    stage: z.string().optional(),
    is_passed: z.boolean().optional(),
    passed_reason: z.string().optional(),
    archived: z.boolean().optional(),
    latest_context: z.string().optional(),
    other_info: z.string().optional(),
    target_completion_date: z.string().optional(),
    exclusivity_end_date: z.string().optional(),
    latest_update: z.string().optional(),
  }),
  add_deal_note: z.object({ deal_id: z.string().optional(), deal: z.string().optional(), note: z.string() }),
  list_next_steps: z.object(dealRef),
  add_workstream: z.object({ deal_id: z.string().optional(), deal: z.string().optional(), name: z.string() }),
  update_workstream: z.object({ workstream_id: z.string(), name: z.string() }),
  add_task: z.object({
    deal_id: z.string().optional(),
    deal: z.string().optional(),
    workstream_id: z.string().optional(),
    workstream: z.string().optional(),
    title: z.string(),
    owner: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    status: z.string().optional(),
    milestone: z.boolean().optional(),
    comment: z.string().optional(),
  }),
  update_task: z.object({
    task_id: z.string(),
    title: z.string().optional(),
    owner: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    status: z.string().optional(),
    milestone: z.boolean().optional(),
    comment: z.string().nullable().optional(),
  }),
  complete_task: z.object({ task_id: z.string(), comment: z.string().optional() }),
  list_partners: z.object({
    query: z.string().optional().describe("Name or company."),
    role: z.string().optional().describe(`Optional partner type. One of: ${PARTNER_ROLES.join(", ")}.`),
  }),
  create_partner: z.object({
    name: z.string(),
    role: z.string().describe(`One of: ${PARTNER_ROLES.join(", ")}.`),
    company: z.string().optional(),
    job_title: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    region_focus: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    linkedin: z.string().optional(),
  }),
  link_partner_to_deal: z.object({ deal_id: z.string().optional(), deal: z.string().optional(), partner_id: z.string(), role: z.string() }),
  unlink_partner_from_deal: z.object({ deal_id: z.string().optional(), deal: z.string().optional(), partner_id: z.string() }),
  list_recent_changes: z.object({ limit: z.number().optional(), claude_only: z.boolean().optional() }),
  undo_change: z.object({ audit_id: z.string() }),
};

export async function callCrmTool(store: CrmStore, name: string, raw: unknown) {
  const handler = handlers[name];
  if (!handler) throw new CrmError(`Unknown tool ${name}.`);
  try {
    return await handler(store, raw ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new CrmError(error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "));
    }
    throw error;
  }
}

export function registerCrmTools(server: McpServer, getStore: () => Promise<CrmStore>) {
  for (const name of CRM_TOOL_NAMES) {
    server.registerTool(name, { description: descriptions[name], inputSchema: schemas[name] }, async (args) => {
      try {
        const store = await getStore();
        const data = await callCrmTool(store, name, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }] };
      }
    });
  }
}

export const SERVER_INSTRUCTIONS = `Deal CRM Template. Search and read deals before you change them. New teasers go on the Pipeline board at Screening/Pipeline unless the user says otherwise. Industry must be exactly one of the allowed industries. sector is the freeform Sub-sector. Passing a deal sets is_passed and moves it to Passed / Out; the process stage stays. Un-passing restores an active board. Archive instead of deleting. A latest update is a note: add_deal_note, or update_deal with latest_update, writes the note and stores that text on the deal. An empty latest update does not clear the previous one. Every write is tagged via Claude and can be undone with undo_change using the returned audit_id. Amounts may be bare numbers plus a currency code, or text such as S$12M.`;
