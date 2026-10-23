import assert from "node:assert/strict";
import test from "node:test";
import { prepareDealPatch } from "./deal-patch.ts";
import {
  buildImportPreview,
  companyMatchKeys,
  dealsMatchingName,
  planImportWrites,
  readDealSheet,
  type ImportPreviewRow,
} from "./import-deals.ts";
import type { Deal, DealTier } from "../types/database.ts";

const NOW = "2026-10-06T03:00:00.000Z";

const HEADERS = [
  "Company Name",
  "Tier",
  "Sector",
  "Country",
  "Source",
  "Description",
  "Latest Context",
  "Owners",
  "Sales",
  "EBITDA",
  "ND/(Cash)",
  "Financial Comments",
  "Entry Date",
  "NBO",
  "DD",
  "Passed",
  "Pass Reason",
  "Proprietary",
  "CRM ID",
  "Action",
];

function deal(partial: Partial<Deal> & Pick<Deal, "id" | "company_name">): Deal {
  return {
    tier: "pipeline",
    sort_order: 10,
    source: "Existing source",
    source_type: "unused-type",
    source_contact: null,
    sector: "Healthcare",
    industry: null,
    country: "Singapore",
    company_description: "Existing description",
    latest_context: "Existing context",
    owners: "Existing owners",
    other_info: null,
    latest_sales: "S$10M",
    latest_ebitda: "S$2M",
    net_debt_cash: "Debt-free",
    financial_comments: null,
    entry_date: "2026-01-15",
    nbo: false,
    dd: false,
    passed: false,
    pass_reason: null,
    archived: false,
    screening_pdf_url: null,
    screening_score: null,
    screening_thesis: null,
    screening_why_own: null,
    screening_why_now: null,
    screening_exit_story: null,
    screening_missing_data: null,
    screening_next_steps: null,
    screening_raw_analysis: null,
    screening_updated_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deal_stage: "Screening/Pipeline",
    sector_group: null,
    sector_detail: null,
    countries: ["Singapore"],
    sales_amount: 10,
    ebitda_amount: 2,
    net_debt_amount: null,
    fin_currency: "SGD",
    fin_currency_assumed: false,
    target_completion_date: null,
    exclusivity_end_date: null,
    exclusivity_extension_date: null,
    latest_update: "Activity note that must stay",
    latest_update_at: "2026-02-01T00:00:00.000Z",
    is_passed: false,
    passed_at: null,
    passed_reason: null,
    is_proprietary: false,
    legal_name: null,
    financial_year: null,
    enterprise_value: null,
    transaction_type: null,
    stake_percent: null,
    ticket_size: null,
    vendor: null,
    ...partial,
  };
}

async function workbook(rows: Record<string, string>[], headers = HEADERS) {
  const loaded = (await import("exceljs")) as typeof import("exceljs") & { default?: typeof import("exceljs") };
  const ExcelJS = typeof loaded.Workbook === "function" ? loaded : loaded.default;
  if (!ExcelJS?.Workbook) throw new Error("Couldn't load the spreadsheet reader.");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Deal Pipeline");
  sheet.addRow([...headers, "Partner note"]);
  for (const row of rows) sheet.addRow([...headers.map((header) => row[header] ?? ""), "scratch note"]);
  const buffer = await book.xlsx.writeBuffer();
  return readDealSheet(buffer as ArrayBuffer);
}

function row(previewRows: ImportPreviewRow[], company: string) {
  const found = previewRows.find((item) => item.companyName === company);
  assert.ok(found, company);
  return found;
}

test("renamed project titles match the company inside the parentheses", () => {
  const widget = deal({ id: "deal-1", company_name: "Widget & Co (Widget Group)" });
  const doctors = deal({ id: "doctors", company_name: "Generic Clinic Hospitals " });
  assert.deepEqual(
    dealsMatchingName([widget], "deal-1 (Widgets Group) [Proprietary]").map((item) => item.id),
    ["deal-1"],
  );
  assert.deepEqual(
    dealsMatchingName([doctors], "deal-6 (Generic Clinics Hospital)").map((item) => item.id),
    ["doctors"],
  );
  assert.ok(companyMatchKeys("Company G Ltd (SGX: X1Y)").every((key) => !key.includes("sgx")));
});

test("blank Latest Context clears latest_context and leaves latest_update and source_type alone", async () => {
  const current = deal({
    id: "alpha",
    company_name: "Alpha Co",
    latest_context: "Old context",
    latest_update: "Activity note that must stay",
    source_type: "unused-type",
  });
  const sheet = await workbook([
    {
      "Company Name": "Alpha Co",
      Tier: "Pipeline",
      "Latest Context": "",
      Sales: "S$10M",
      EBITDA: "S$2M",
      "ND/(Cash)": "Debt-free",
      "Entry Date": "2026-01-15",
      Sector: "Healthcare",
      Country: "Singapore",
      Source: "Existing source",
      Description: "Existing description",
      Owners: "Existing owners",
    },
  ]);
  const preview = buildImportPreview(sheet, [current], NOW);
  const match = row(preview.rows, "Alpha Co");
  assert.equal(match.kind, "update");
  assert.equal(match.patch.latest_context, null);
  assert.equal("latest_update" in match.patch, false);
  assert.equal("latest_update_at" in match.patch, false);
  assert.equal("source_type" in match.patch, false);
  assert.equal(preview.ignoredHeaders.includes("Partner note"), true);
});

test("a file without Latest Context does not clear it", async () => {
  const headers = HEADERS.filter((header) => header !== "Latest Context");
  const current = deal({ id: "alpha", company_name: "Alpha Co", latest_context: "Keep me" });
  const sheet = await workbook(
    [{ "Company Name": "Alpha Co", Tier: "Pipeline", Sector: "Healthcare", Country: "Singapore", Source: "Existing source", Description: "Existing description", Owners: "Existing owners", Sales: "S$10M", EBITDA: "S$2M", "ND/(Cash)": "Debt-free", "Entry Date": "2026-01-15" }],
    headers,
  );
  const preview = buildImportPreview(sheet, [current], NOW);
  assert.equal("latest_context" in row(preview.rows, "Alpha Co").patch, false);
});

test("Passed and Pass Reason write both the screen fields and the export fields", async () => {
  const current = deal({
    id: "alpha",
    company_name: "Alpha Co",
    tier: "pipeline",
    is_passed: false,
    passed: false,
    passed_reason: "old ui",
    pass_reason: "old export",
  });
  const sheet = await workbook([
    {
      "Company Name": "Alpha Co",
      Tier: "Pipeline",
      Passed: "Yes",
      "Pass Reason": "price",
      Sector: "Healthcare",
      Country: "Singapore",
      Source: "Existing source",
      Description: "Existing description",
      Owners: "Existing owners",
      Sales: "S$10M",
      EBITDA: "S$2M",
      "ND/(Cash)": "Debt-free",
      "Entry Date": "2026-01-15",
      "Latest Context": "Existing context",
    },
  ]);
  const match = row(buildImportPreview(sheet, [current], NOW).rows, "Alpha Co");
  assert.equal(match.patch.tier, "passed");
  assert.equal(match.patch.is_passed, true);
  assert.equal(match.patch.passed, true);
  assert.equal(match.patch.passed_at, NOW);
  assert.equal(match.patch.passed_reason, "price");
  assert.equal(match.patch.pass_reason, "price");

  const cleared = deal({
    id: "beta",
    company_name: "Beta Co",
    tier: "passed",
    is_passed: true,
    passed: true,
    passed_at: "2026-03-01T00:00:00.000Z",
    passed_reason: "price",
    pass_reason: "price",
  });
  const clearSheet = await workbook([
    {
      "Company Name": "Beta Co",
      Tier: "Passed / Out",
      Passed: "Yes",
      "Pass Reason": "",
      Sector: "Healthcare",
      Country: "Singapore",
      Source: "Existing source",
      Description: "Existing description",
      Owners: "Existing owners",
      Sales: "S$10M",
      EBITDA: "S$2M",
      "ND/(Cash)": "Debt-free",
      "Entry Date": "2026-01-15",
      "Latest Context": "Existing context",
    },
  ]);
  const clearedRow = row(buildImportPreview(clearSheet, [cleared], NOW).rows, "Beta Co");
  assert.equal(clearedRow.patch.passed_reason, null);
  assert.equal(clearedRow.patch.pass_reason, null);
  assert.equal("tier" in clearedRow.patch, false);
});

test("a passed-board deal whose legacy passed flag is false gets both flags synced", async () => {
  const current = deal({
    id: "deal-7",
    company_name: "deal-7",
    tier: "passed",
    is_passed: true,
    passed: false,
    passed_at: "2026-04-01T00:00:00.000Z",
  });
  const sheet = await workbook([
    {
      "Company Name": "deal-7",
      Tier: "Passed / Out",
      Passed: "",
      Sector: "Healthcare",
      Country: "Singapore",
      Source: "Existing source",
      Description: "Existing description",
      Owners: "Existing owners",
      Sales: "S$10M",
      EBITDA: "S$2M",
      "ND/(Cash)": "Debt-free",
      "Entry Date": "2026-01-15",
      "Latest Context": "Existing context",
    },
  ]);
  const match = row(buildImportPreview(sheet, [current], NOW).rows, "deal-7");
  assert.equal(match.patch.is_passed, true);
  assert.equal(match.patch.passed, true);
  assert.equal(match.patch.passed_at, "2026-04-01T00:00:00.000Z");
  assert.equal(match.changes.some((change) => change.label === "Passed" && change.after === "Yes"), true);
});

test("Proprietary Yes and blank write is_proprietary, and a missing column leaves it alone", async () => {
  const current = deal({ id: "alpha", company_name: "Alpha Co", is_proprietary: false });
  const sheet = await workbook([
    {
      "Company Name": "Alpha Co",
      Tier: "Pipeline",
      Proprietary: "Yes",
      Sector: "Healthcare",
      Country: "Singapore",
      Source: "Existing source",
      Description: "Existing description",
      Owners: "Existing owners",
      Sales: "S$10M",
      EBITDA: "S$2M",
      "ND/(Cash)": "Debt-free",
      "Entry Date": "2026-01-15",
      "Latest Context": "Existing context",
    },
  ]);
  assert.equal(row(buildImportPreview(sheet, [current], NOW).rows, "Alpha Co").patch.is_proprietary, true);

  const headers = HEADERS.filter((header) => header !== "Proprietary");
  const without = await workbook(
    [{
      "Company Name": "Alpha Co",
      Tier: "Pipeline",
      Sector: "Healthcare",
      Country: "Singapore",
      Source: "Existing source",
      Description: "Existing description",
      Owners: "Existing owners",
      Sales: "S$10M",
      EBITDA: "S$2M",
      "ND/(Cash)": "Debt-free",
      "Entry Date": "2026-01-15",
      "Latest Context": "Existing context",
    }],
    headers,
  );
  const unchanged = row(buildImportPreview(without, [current], NOW).rows, "Alpha Co");
  assert.equal("is_proprietary" in unchanged.patch, false);
  assert.equal(unchanged.kind, "unchanged");
});

test("CRM ID wins over a different company name", async () => {
  const current = deal({ id: "11111111-1111-4111-8111-111111111111", company_name: "Alpha Co" });
  const sheet = await workbook([
    {
      "Company Name": "A completely different title",
      "CRM ID": "11111111-1111-4111-8111-111111111111",
      Tier: "Pipeline",
      Sector: "Healthcare",
      Country: "Singapore",
      Source: "Existing source",
      Description: "Existing description",
      Owners: "Existing owners",
      Sales: "S$10M",
      EBITDA: "S$2M",
      "ND/(Cash)": "Debt-free",
      "Entry Date": "2026-01-15",
      "Latest Context": "Existing context",
    },
  ]);
  const match = buildImportPreview(sheet, [current], NOW).rows[0];
  assert.equal(match.match, "crm_id");
  assert.equal(match.dealId, current.id);
  assert.equal(match.patch.company_name, "A completely different title");
});

test("Delete matches only a CRM ID", async () => {
  const alpha = deal({ id: "11111111-1111-4111-8111-111111111111", company_name: "Alpha Co" });
  const twin = deal({ id: "22222222-2222-4222-8222-222222222222", company_name: "Alpha Co" });
  const sheet = await workbook([
    { "Company Name": "Alpha Co", Action: "Delete" },
    { "Company Name": "Someone else", "CRM ID": alpha.id, Action: "Delete" },
    { "Company Name": "Alpha Co", "CRM ID": "not-a-uuid", Action: "Delete" },
  ]);
  const preview = buildImportPreview(sheet, [alpha, twin], NOW);
  assert.equal(preview.rows[0].kind, "error");
  assert.equal(preview.rows[1].kind, "delete");
  assert.equal(preview.rows[1].dealId, alpha.id);
  assert.match(preview.rows[1].note ?? "", /Someone else|different/i);
  assert.equal(preview.rows[2].kind, "error");
  const writes = planImportWrites(preview, [alpha, twin]);
  assert.deepEqual(writes, [{ op: "delete", id: alpha.id }]);
});

test("money text is kept and still becomes card numbers", async () => {
  const sheet = await workbook([
    {
      "Company Name": "New Money Co",
      Tier: "Active Tier II",
      Sales: "THB805M",
      EBITDA: "~US$5M",
      "ND/(Cash)": "RMB146M",
      Country: "Thailand",
    },
  ]);
  const created = row(buildImportPreview(sheet, [], NOW).rows, "New Money Co");
  assert.equal(created.kind, "create");
  assert.equal(created.patch.latest_sales, "THB805M");
  assert.equal(created.patch.latest_ebitda, "~US$5M");
  assert.equal(created.patch.net_debt_cash, "RMB146M");
  const prepared = prepareDealPatch(created.patch);
  assert.equal(prepared.latest_ebitda, "~US$5M");
  assert.equal(prepared.ebitda_amount, 5);
  assert.equal(prepared.sales_amount, 805);
  assert.equal(prepared.net_debt_amount, 146);
  assert.equal(prepared.fin_currency, null);
});

test("new deals and board moves land at the top in file order", async () => {
  const staying = deal({ id: "stay", company_name: "Staying Co", tier: "pipeline", sort_order: 5 });
  const moving = deal({ id: "move", company_name: "Moving Co", tier: "active_tier_1", sort_order: 2 });
  const passedBoard = deal({ id: "old-pass", company_name: "Old Pass", tier: "passed", sort_order: 5 });
  const sheet = await workbook([
    { "Company Name": "First New", Tier: "Pipeline", Country: "Singapore" },
    { "Company Name": "Second New", Tier: "Pipeline", Country: "Malaysia" },
    { "Company Name": "Moving Co", Tier: "Passed / Out", Passed: "Yes" },
  ]);
  const preview = buildImportPreview(sheet, [staying, moving, passedBoard], NOW);
  const writes = planImportWrites(preview, [staying, moving, passedBoard]);
  const move = writes.find((write) => write.op === "update");
  const creates = writes.filter((write) => write.op === "create");
  assert.equal(move && move.op === "update" ? move.patch.tier : "", "passed");
  assert.equal(move && move.op === "update" ? move.patch.sort_order : null, 4);
  assert.equal(move && move.op === "update" ? move.patch.is_passed : null, true);
  assert.deepEqual(creates.map((write) => write.op === "create" ? write.patch.sort_order : null), [3, 4]);
  assert.equal(creates[0]?.op === "create" ? creates[0].patch.company_name : "", "First New");
});

test("a second row for the same company is held out", async () => {
  const sampleE = deal({ id: "sampleE", company_name: "deal-5" });
  const sheet = await workbook([
    { "Company Name": "deal-5", Description: "First" },
    { "Company Name": "deal-5", Description: "Second" },
  ]);
  const preview = buildImportPreview(sheet, [sampleE], NOW);
  assert.equal(preview.rows[0].included, true);
  assert.equal(preview.rows[0].dealId, "sampleE");
  assert.equal(preview.rows[1].included, false);
  assert.equal(preview.rows[1].needsChoice, true);
  const writes = planImportWrites(preview, [sampleE]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.op === "update" ? writes[0].patch.company_description : "", "First");
});

test("two creates on an empty board keep file order from the top", () => {
  const preview = buildImportPreview(
    {
      present: ["company_name", "tier"],
      ignoredHeaders: [],
      rows: [
        { rowNumber: 2, fileIndex: 0, action: "upsert", crmId: null, invalidCrmId: false, companyName: "A", unrecognizedTier: null, invalidIndustry: null, invalidEntryDate: false, values: { company_name: "A", tier: "pipeline" as DealTier } },
        { rowNumber: 3, fileIndex: 1, action: "upsert", crmId: null, invalidCrmId: false, companyName: "B", unrecognizedTier: null, invalidIndustry: null, invalidEntryDate: false, values: { company_name: "B", tier: "pipeline" as DealTier } },
      ],
    },
    [],
    NOW,
  );
  const writes = planImportWrites(preview, []);
  assert.deepEqual(
    writes.map((write) => write.op === "create" ? [write.patch.company_name, write.patch.sort_order] : null),
    [["A", 0], ["B", 1]],
  );
});

test("Industry is validated, canonicalised, and a blank cell clears it", async () => {
  const alpha = deal({ id: "11111111-1111-4111-8111-111111111111", company_name: "Alpha Co", industry: "Logistics" });
  const headers = ["Company Name", "CRM ID", "Industry", "Sector"];
  const valid = await workbook(
    [{ "Company Name": "Alpha Co", "CRM ID": alpha.id, Industry: "ict & media", Sector: "IT Services" }],
    headers,
  );
  const applied = buildImportPreview(valid, [alpha], NOW);
  assert.equal(applied.rows[0].patch.industry, "ICT & Media");
  assert.equal(applied.rows[0].patch.sector, "IT Services");
  assert.equal(applied.rows[0].note, null);

  const invalid = await workbook(
    [{ "Company Name": "Alpha Co", "CRM ID": alpha.id, Industry: "Widgets", Sector: "Healthcare" }],
    headers,
  );
  const flagged = buildImportPreview(invalid, [alpha], NOW);
  assert.equal(flagged.rows[0].patch.industry, undefined);
  assert.match(flagged.rows[0].note ?? "", /Widgets/);
  assert.equal(flagged.rows[0].kind, "unchanged");

  const cleared = await workbook(
    [{ "Company Name": "Alpha Co", "CRM ID": alpha.id, Industry: "", Sector: "Healthcare" }],
    headers,
  );
  const blank = buildImportPreview(cleared, [alpha], NOW);
  assert.equal(blank.rows[0].patch.industry, null);
});
