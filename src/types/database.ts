export type DealTier = "active_tier_1" | "active_tier_2" | "pipeline" | "passed";
export type RealizedStatus = "closed" | "analysis" | "portfolio";
export type PartnerRole = "advisors" | "operators" | "co-investors" | "others" | "bankers" | "lawyers" | "lenders";
export type RoleOnDeal = "source" | "advisor" | "co-investor" | "operator" | "other" | "lender" | "introducer";
export type TaskStatus = "not_started" | "in_motion" | "at_risk" | "done" | "blocked";

export const DEAL_STAGES = [
  "Screening/Pipeline",
  "NBIO / Term Sheet",
  "Due Diligence",
  "SPA / Signing",
  "Completed",
  "Passed",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export interface Deal {
  id: string;
  company_name: string;
  tier: DealTier;
  sort_order: number;
  source: string | null;
  source_type: string | null;
  source_contact: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  company_description: string | null;
  latest_context: string | null;
  owners: string | null;
  other_info: string | null;
  latest_sales: string | null;
  latest_ebitda: string | null;
  net_debt_cash: string | null;
  financial_comments: string | null;
  entry_date: string | null;
  nbo: boolean;
  dd: boolean;
  passed: boolean;
  pass_reason: string | null;
  archived: boolean;
  screening_pdf_url: string | null;
  screening_score: number | null;
  screening_thesis: string | null;
  screening_why_own: string | null;
  screening_why_now: string | null;
  screening_exit_story: string | null;
  screening_missing_data: string[] | null;
  screening_next_steps: string[] | null;
  screening_raw_analysis: string | null;
  screening_updated_at: string | null;
  created_at: string;
  updated_at: string;
  deal_stage: DealStage | null;
  sector_group: string | null;
  sector_detail: string | null;
  countries: string[] | null;
  sales_amount: number | null;
  ebitda_amount: number | null;
  net_debt_amount: number | null;
  fin_currency: string | null;
  fin_currency_assumed: boolean;
  target_completion_date: string | null;
  exclusivity_end_date: string | null;
  exclusivity_extension_date: string | null;
  latest_update: string | null;
  latest_update_at: string | null;
  is_passed: boolean;
  passed_at: string | null;
  passed_reason: string | null;
  is_proprietary: boolean;
  legal_name: string | null;
  financial_year: string | null;
  enterprise_value: string | null;
  transaction_type: string | null;
  stake_percent: number | null;
  ticket_size: string | null;
  vendor: string | null;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  content: string;
  created_at: string;
}

export interface DealStageHistory {
  id: string;
  deal_id: string;
  field: "tier" | "stage";
  from_value: string | null;
  to_value: string | null;
  changed_at: string;
  note: string | null;
}

export interface RealizedDeal {
  id: string;
  company_name: string;
  status: RealizedStatus;
  team_member: string | null;
  source: string | null;
  sector: string | null;
  company_description: string | null;
  description: string | null;
  owners: string | null;
  deal_type: string | null;
  sales: string | null;
  ebitda: string | null;
  debt: string | null;
  comments: string | null;
  country: string | null;
  entry_date: string | null;
  pass_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  name: string;
  role: PartnerRole;
  sector_focus: string[] | null;
  region_focus: string | null;
  relevant_deals: string[] | null;
  notes: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  job_title: string | null;
  company: string | null;
  description: string | null;
  linkedin: string | null;
  last_contacted: string | null;
  avatar_url: string | null;
  tags: string[] | null;
}

export interface DealPartner {
  id: string;
  deal_id: string;
  partner_id: string;
  role_on_deal: RoleOnDeal;
  created_at: string;
}

export interface PartnerNote {
  id: string;
  partner_id: string;
  content: string;
  created_at: string;
}

export interface DealWorkstream {
  id: string;
  deal_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface DealTask {
  id: string;
  workstream_id: string;
  deal_id: string;
  title: string;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  is_milestone: boolean;
  status: TaskStatus;
  comment: string | null;
  sort_order: number;
  created_at: string;
}


export interface Database {
  public: {
    Tables: {
      deals: { Row: Deal; Insert: Partial<Deal> & { company_name: string }; Update: Partial<Deal> };
      deal_activities: { Row: DealActivity; Insert: Partial<DealActivity> & { deal_id: string; content: string }; Update: Partial<DealActivity> };
      realized_deals: { Row: RealizedDeal; Insert: Partial<RealizedDeal> & { company_name: string }; Update: Partial<RealizedDeal> };
      partners: { Row: Partner; Insert: Partial<Partner> & { name: string; role: PartnerRole }; Update: Partial<Partner> };
      deal_partners: { Row: DealPartner; Insert: Partial<DealPartner> & { deal_id: string; partner_id: string }; Update: Partial<DealPartner> };
      partner_notes: { Row: PartnerNote; Insert: Partial<PartnerNote> & { partner_id: string; content: string }; Update: Partial<PartnerNote> };
      deal_workstreams: { Row: DealWorkstream; Insert: Partial<DealWorkstream> & { deal_id: string; name: string }; Update: Partial<DealWorkstream> };
      deal_tasks: { Row: DealTask; Insert: Partial<DealTask> & { workstream_id: string; deal_id: string; title: string }; Update: Partial<DealTask> };
      deal_stage_history: { Row: DealStageHistory; Insert: Partial<DealStageHistory> & { deal_id: string; field: DealStageHistory["field"] }; Update: Partial<DealStageHistory> };
    };
  };
}
