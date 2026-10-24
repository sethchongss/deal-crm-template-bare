import { PARTNER_ROLES } from "@/lib/constants";
import { amountToText } from "@/lib/deal-form";
import { blankToNull, prepareDealPatch } from "@/lib/deal-patch";
import { parseFinancial } from "@/lib/financials";
import { INDUSTRIES, matchIndustry } from "@/lib/industries";
import { passedFlagsAfterTierMove, type KanbanTier } from "@/lib/kanban-order";
import { DEAL_STAGES, type Deal, type DealStage, type DealTier, type PartnerRole, type RoleOnDeal, type TaskStatus } from "@/types/database";

export { PARTNER_ROLES };

export class CrmError extends Error {}

const BOARDS: Record<string, DealTier> = {
  active: "active",
  // Older names for the two retired active boards.
  active_tier_1: "active",
  "active tier i": "active",
  "active tier 1": "active",
  "tier i": "active",
  active_tier_2: "active",
  "active tier ii": "active",
  "active tier 2": "active",
  "tier ii": "active",
  pipeline: "pipeline",
  passed: "passed",
  "passed / out": "passed",
  "passed/out": "passed",
};

export function parseBoard(value: string): DealTier {
  const board = BOARDS[value.trim().toLowerCase()];
  if (!board) throw new CrmError("Board must be Active, Pipeline, or Passed / Out.");
  return board;
}

export function parseStage(value: string): DealStage {
  const match = DEAL_STAGES.find((stage) => stage.toLowerCase() === value.trim().toLowerCase());
  if (!match) throw new CrmError(`Stage must be one of: ${DEAL_STAGES.filter((stage) => stage !== "Passed").join(", ")}.`);
  if (match === "Passed") throw new CrmError("The Passed stage is retired. Mark the deal passed instead; its stage stays where it was.");
  return match;
}

export function optionalText(value: unknown, max: number, label: string) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new CrmError(`${label} is too long (max ${max} characters).`);
  return text;
}

export function requireText(value: unknown, max: number, label: string) {
  const text = optionalText(value, max, label);
  if (!text) throw new CrmError(`${label} is required.`);
  return text;
}

export function optionalDate(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    throw new CrmError(`${label} must be a real date in YYYY-MM-DD form.`);
  }
  return text;
}

export function optionalStake(value: unknown) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new CrmError("stake_percent must be between 0 and 100.");
  return number;
}

/** Bare numbers pick up the currency and a millions suffix, the same way the deal form does. */
export function financialText(value: unknown, currency: string | null | undefined, label: string) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > 80) throw new CrmError(`${label} is too long.`);
  const parsed = parseFinancial(text);
  if (parsed.currency || /[$€£]/.test(text)) return text;
  const currencyCode = optionalText(currency, 8, "currency");
  return amountToText(text, currencyCode);
}

export type DealWriteInput = {
  name?: unknown;
  codename?: unknown;
  company_name?: unknown;
  company?: unknown;
  legal_name?: unknown;
  sector?: unknown;
  industry?: unknown;
  country?: unknown;
  description?: unknown;
  source?: unknown;
  source_type?: unknown;
  source_contact?: unknown;
  owners?: unknown;
  revenue?: unknown;
  ebitda?: unknown;
  net_debt?: unknown;
  currency?: unknown;
  financial_year?: unknown;
  enterprise_value?: unknown;
  transaction_type?: unknown;
  stake_percent?: unknown;
  ticket_size?: unknown;
  vendor?: unknown;
  board?: unknown;
  stage?: unknown;
  latest_context?: unknown;
  other_info?: unknown;
  financial_comments?: unknown;
  is_passed?: unknown;
  passed_reason?: unknown;
  archived?: unknown;
  target_completion_date?: unknown;
  exclusivity_end_date?: unknown;
  exclusivity_extension_date?: unknown;
};

function optionalIndustry(value: unknown) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  const matched = matchIndustry(text);
  if (!matched) throw new CrmError(`Industry must be one of: ${INDUSTRIES.join(", ")}.`);
  return matched;
}

function dealFields(input: DealWriteInput, currency: string | null) {
  const fields: Partial<Deal> = {};
  const name = input.name ?? input.codename ?? input.company_name;
  if (name !== undefined) fields.company_name = requireText(name, 200, "Deal name");
  if (input.company !== undefined || input.legal_name !== undefined) {
    fields.legal_name = optionalText(input.company ?? input.legal_name, 300, "Company");
  }
  if (input.sector !== undefined) fields.sector = optionalText(input.sector, 200, "Sector");
  if (input.industry !== undefined) fields.industry = optionalIndustry(input.industry);
  if (input.country !== undefined) fields.country = optionalText(input.country, 200, "Country");
  if (input.description !== undefined) fields.company_description = optionalText(input.description, 12000, "Description");
  if (input.source !== undefined) fields.source = optionalText(input.source, 300, "Source");
  if (input.source_type !== undefined) fields.source_type = optionalText(input.source_type, 120, "Source type");
  if (input.source_contact !== undefined) fields.source_contact = optionalText(input.source_contact, 200, "Source contact");
  if (input.owners !== undefined) fields.owners = optionalText(input.owners, 200, "Deal lead");
  if (input.revenue !== undefined) fields.latest_sales = financialText(input.revenue, currency, "Revenue");
  if (input.ebitda !== undefined) fields.latest_ebitda = financialText(input.ebitda, currency, "EBITDA");
  if (input.net_debt !== undefined) fields.net_debt_cash = financialText(input.net_debt, currency, "Net debt");
  if (input.financial_year !== undefined) fields.financial_year = optionalText(input.financial_year, 40, "Financial year");
  if (input.enterprise_value !== undefined) fields.enterprise_value = financialText(input.enterprise_value, currency, "Enterprise value");
  if (input.transaction_type !== undefined) fields.transaction_type = optionalText(input.transaction_type, 80, "Transaction type");
  if (input.stake_percent !== undefined) fields.stake_percent = optionalStake(input.stake_percent);
  if (input.ticket_size !== undefined) fields.ticket_size = optionalText(input.ticket_size, 80, "Ticket size");
  if (input.vendor !== undefined) fields.vendor = optionalText(input.vendor, 300, "Vendor");
  if (input.latest_context !== undefined) fields.latest_context = optionalText(input.latest_context, 8000, "Context");
  if (input.other_info !== undefined) fields.other_info = optionalText(input.other_info, 8000, "Other info");
  if (input.financial_comments !== undefined) fields.financial_comments = optionalText(input.financial_comments, 4000, "Financial comments");
  if (input.target_completion_date !== undefined) fields.target_completion_date = optionalDate(input.target_completion_date, "Target completion");
  if (input.exclusivity_end_date !== undefined) fields.exclusivity_end_date = optionalDate(input.exclusivity_end_date, "Exclusivity end");
  if (input.exclusivity_extension_date !== undefined) fields.exclusivity_extension_date = optionalDate(input.exclusivity_extension_date, "Exclusivity extension");
  return fields;
}

export function buildCreateDeal(input: DealWriteInput, sortOrder: number): Partial<Deal> & { company_name: string } {
  const currency = optionalText(input.currency, 8, "currency");
  const fields = dealFields(input, currency);
  if (!fields.company_name) throw new CrmError("Deal name (or codename) is required.");
  const tier = input.board == null || input.board === "" ? "pipeline" : parseBoard(String(input.board));
  const stage = input.stage == null || input.stage === "" ? "Screening/Pipeline" : parseStage(String(input.stage));
  const passed = tier === "passed";
  const row = blankToNull({
    ...fields,
    company_name: fields.company_name,
    tier,
    deal_stage: stage,
    sort_order: sortOrder,
    entry_date: new Date().toISOString().slice(0, 10),
    is_passed: passed,
    passed,
    passed_at: passed ? new Date().toISOString() : null,
    archived: false,
  });
  return prepareDealPatch(row) as Partial<Deal> & { company_name: string };
}

export function buildUpdateDeal(current: Pick<Deal, "tier" | "passed_at" | "deal_stage" | "latest_sales" | "latest_ebitda" | "net_debt_cash" | "sector" | "country">, input: DealWriteInput, restoreBoard: DealTier | null) {
  const currency = optionalText(input.currency, 8, "currency");
  const patch: Partial<Deal> = dealFields(input, currency);
  if (input.stage != null && input.stage !== "") patch.deal_stage = parseStage(String(input.stage));
  const requestedBoard = input.board == null || input.board === "" ? undefined : parseBoard(String(input.board));
  if (input.is_passed === true && requestedBoard && requestedBoard !== "passed") {
    throw new CrmError("Marking a deal passed moves it to Passed / Out and keeps its stage. Leave board empty, or set board to passed.");
  }
  if (input.is_passed === false && requestedBoard === "passed") {
    throw new CrmError("Un-passing a deal restores an active board. Use active or pipeline.");
  }
  if (typeof input.archived === "boolean") patch.archived = input.archived;
  if (input.passed_reason !== undefined) {
    const reason = optionalText(input.passed_reason, 2000, "Passed reason");
    patch.passed_reason = reason;
    patch.pass_reason = reason;
  }

  if (input.is_passed === true) {
    patch.is_passed = true;
    patch.passed = true;
    patch.passed_at = current.passed_at ?? new Date().toISOString();
    patch.tier = "passed";
  } else if (input.is_passed === false) {
    patch.is_passed = false;
    patch.passed = false;
    patch.passed_at = null;
    patch.tier = requestedBoard && requestedBoard !== "passed"
      ? requestedBoard
      : current.tier === "passed"
        ? restoreBoard ?? "pipeline"
        : current.tier;
  } else if (requestedBoard) {
    patch.tier = requestedBoard;
    const change = passedFlagsAfterTierMove(current.tier as KanbanTier, requestedBoard);
    if (change === "set") {
      patch.is_passed = true;
      patch.passed = true;
      patch.passed_at = current.passed_at ?? new Date().toISOString();
    } else if (change === "clear") {
      patch.is_passed = false;
      patch.passed = false;
      patch.passed_at = null;
    }
  }

  if (Object.keys(patch).length === 0) throw new CrmError("No fields to update.");
  return prepareDealPatch(patch, current);
}

export const ROLES_ON_DEAL: RoleOnDeal[] = ["source", "advisor", "co-investor", "operator", "other", "lender", "introducer"];
export const TASK_STATUSES: TaskStatus[] = ["not_started", "in_motion", "at_risk", "done", "blocked"];

export function parsePartnerRole(value: string): PartnerRole {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, PartnerRole> = {
    advisor: "advisors",
    banker: "bankers",
    lender: "lenders",
    lawyer: "lawyers",
    operator: "operators",
    "co-investor": "co-investors",
    coinvestor: "co-investors",
    other: "others",
  };
  const role = aliases[normalized] ?? PARTNER_ROLES.find((item) => item === normalized);
  if (!role) throw new CrmError(`Partner role must be one of: ${PARTNER_ROLES.join(", ")}.`);
  return role;
}

export function parseRoleOnDeal(value: string): RoleOnDeal {
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  const role = ROLES_ON_DEAL.find((item) => item === normalized);
  if (!role) throw new CrmError(`Role on the deal must be one of: ${ROLES_ON_DEAL.join(", ")}.`);
  return role;
}

export function parseTaskStatus(value: string): TaskStatus {
  const normalized = value.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
  const aliases: Record<string, TaskStatus> = { complete: "done", completed: "done", in_progress: "in_motion", progress: "in_motion" };
  const status = aliases[normalized] ?? TASK_STATUSES.find((item) => item === normalized);
  if (!status) throw new CrmError(`Task status must be one of: ${TASK_STATUSES.join(", ")}.`);
  return status;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
