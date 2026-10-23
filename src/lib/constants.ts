import type {
  DealStage,
  DealTier,
  PartnerRole,
  RealizedStatus,
  RoleOnDeal,
  TaskStatus,
} from "@/types/database";
import { DEAL_STAGES } from "@/types/database";
import { STAGE_TONE, TIER_TONE, type TagTone } from "@/lib/tag-styles";

export type { TagTone } from "@/lib/tag-styles";
export { TAG_CLASS, TAG_TONES, toneForKey } from "@/lib/tag-styles";

export const TIER_ORDER: DealTier[] = ["active_tier_1", "active_tier_2", "pipeline", "passed"];

export const TIER_CONFIG: Record<DealTier, { label: string; tone: TagTone; dot: string }> = {
  active_tier_1: { label: "Active Tier I", tone: TIER_TONE.active_tier_1, dot: "bg-[var(--tag-teal-text)]" },
  active_tier_2: { label: "Active Tier II", tone: TIER_TONE.active_tier_2, dot: "bg-[var(--tag-blue-text)]" },
  pipeline: { label: "Pipeline", tone: TIER_TONE.pipeline, dot: "bg-[var(--tag-amber-text)]" },
  passed: { label: "Passed / Out", tone: TIER_TONE.passed, dot: "bg-[var(--tag-slate-text)]" },
};

export const STAGE_CONFIG: Record<DealStage, { tone: TagTone }> = {
  "Screening/Pipeline": { tone: STAGE_TONE["Screening/Pipeline"] },
  "NBIO / Term Sheet": { tone: STAGE_TONE["NBIO / Term Sheet"] },
  "Due Diligence": { tone: STAGE_TONE["Due Diligence"] },
  "SPA / Signing": { tone: STAGE_TONE["SPA / Signing"] },
  Completed: { tone: STAGE_TONE.Completed },
  Passed: { tone: STAGE_TONE.Passed },
};

export const DEAL_STAGE_OPTIONS = DEAL_STAGES;

export const STATUS_CONFIG: Record<RealizedStatus, { label: string; tone: TagTone }> = {
  closed: { label: "Closed", tone: "green" },
  analysis: { label: "Analysis", tone: "blue" },
  portfolio: { label: "Portfolio", tone: "purple" },
};

export const PARTNER_ROLE_CONFIG: Record<PartnerRole, { label: string; tone: TagTone }> = {
  advisors: { label: "Advisor", tone: "purple" },
  operators: { label: "Operator", tone: "green" },
  "co-investors": { label: "Co-investor", tone: "blue" },
  bankers: { label: "Banker", tone: "amber" },
  lenders: { label: "Lender", tone: "orange" },
  lawyers: { label: "Lawyer", tone: "teal" },
  others: { label: "Other", tone: "neutral" },
};

export const PARTNER_ROLES: PartnerRole[] = ["advisors", "bankers", "lenders", "lawyers", "co-investors", "operators", "others"];

export const ROLE_ON_DEAL_LABEL: Record<RoleOnDeal, string> = {
  source: "Introducer / source",
  introducer: "Introducer / source",
  advisor: "Advisor",
  "co-investor": "Co-investor",
  operator: "Operator",
  lender: "Lender",
  other: "Other",
};

export const ROLE_ON_DEAL_TONE: Record<RoleOnDeal, TagTone> = {
  source: "amber",
  introducer: "amber",
  advisor: "blue",
  "co-investor": "green",
  operator: "moss",
  lender: "orange",
  other: "neutral",
};

export const ROLES_ON_DEAL: RoleOnDeal[] = ["co-investor", "advisor", "source", "lender", "operator", "other"];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_motion: "In progress",
  blocked: "Blocked",
  at_risk: "At risk",
  done: "Done",
};

export const TASK_STATUSES: TaskStatus[] = ["not_started", "in_motion", "blocked", "done"];

export const TRANSACTION_TYPES = ["Buyout", "Growth", "Secondary", "Primary", "Carve-out", "Other"] as const;

