import type { Deal } from "@/types/database";

/** Columns the pipeline export writes, in order. Import matches these by header, not position. */
export const DEAL_SHEET_COLUMNS = [
  { header: "Company Name", key: "company_name", width: 30 },
  { header: "Tier", key: "tier", width: 16 },
  { header: "Sector", key: "sector", width: 25 },
  { header: "Industry", key: "industry", width: 28 },
  { header: "Country", key: "country", width: 18 },
  { header: "Source", key: "source", width: 18 },
  { header: "Description", key: "company_description", width: 50 },
  { header: "Latest Context", key: "latest_context", width: 40 },
  { header: "Owners", key: "owners", width: 30 },
  { header: "Sales", key: "latest_sales", width: 16 },
  { header: "EBITDA", key: "latest_ebitda", width: 16 },
  { header: "ND/(Cash)", key: "net_debt_cash", width: 16 },
  { header: "Financial Comments", key: "financial_comments", width: 40 },
  { header: "Entry Date", key: "entry_date", width: 14 },
  { header: "NBO", key: "nbo", width: 8 },
  { header: "DD", key: "dd", width: 8 },
  { header: "Passed", key: "passed", width: 10 },
  { header: "Pass Reason", key: "pass_reason", width: 30 },
  { header: "Proprietary", key: "is_proprietary", width: 14 },
  { header: "CRM ID", key: "id", width: 38 },
] as const;

export type DealSheetField = (typeof DEAL_SHEET_COLUMNS)[number]["key"];

export type DealSheetColumn = DealSheetField | "action";

const HEADER_ALIASES: Record<string, DealSheetColumn> = {
  companyname: "company_name",
  tier: "tier",
  sector: "sector",
  industry: "industry",
  subsector: "sector",
  "sub-sector": "sector",
  country: "country",
  source: "source",
  description: "company_description",
  latestcontext: "latest_context",
  owners: "owners",
  sales: "latest_sales",
  ebitda: "latest_ebitda",
  "nd/(cash)": "net_debt_cash",
  "nd/cash": "net_debt_cash",
  netdebt: "net_debt_cash",
  "netdebt/(cash)": "net_debt_cash",
  financialcomments: "financial_comments",
  entrydate: "entry_date",
  nbo: "nbo",
  dd: "dd",
  passed: "passed",
  passreason: "pass_reason",
  proprietary: "is_proprietary",
  crmid: "id",
  dealid: "id",
  action: "action",
};

export function headerKey(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "");
}

export function columnForHeader(header: string): DealSheetColumn | null {
  return HEADER_ALIASES[headerKey(header)] ?? null;
}

export function exportCell(deal: Deal, key: DealSheetField): string {
  if (key === "id") return deal.id;
  if (key === "is_proprietary") return deal.is_proprietary ? "Yes" : "";
  if (key === "nbo") return deal.nbo ? "Yes" : "";
  if (key === "dd") return deal.dd ? "Yes" : "";
  if (key === "passed") return deal.passed ? "Yes" : "";
  const value = deal[key];
  if (value == null) return "";
  return String(value);
}
