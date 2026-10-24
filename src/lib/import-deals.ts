import { DEAL_SHEET_COLUMNS, columnForHeader, type DealSheetColumn, type DealSheetField } from "@/lib/deal-sheet";
import { TIER_CONFIG } from "@/lib/constants";
import { matchIndustry } from "@/lib/industries";
import type { Deal, DealTier } from "@/types/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXCHANGE = /\((?:sgx|hkex|aim|nyse|nasdaq)\s*:[^)]*\)/gi;
const PROPRIETARY_MARK = /\[\s*proprietary\s*\]/gi;

const TIER_LABELS: Record<string, DealTier> = {
  pipeline: "pipeline",
  active: "active",
  // Older exports used two active boards. Both now land on Active.
  "active tier i": "active",
  "active tier 1": "active",
  "active tier ii": "active",
  "active tier 2": "active",
  active_tier_1: "active",
  active_tier_2: "active",
  "passed / out": "passed",
  "passed/out": "passed",
  passed: "passed",
  out: "passed",
};

const TEXT_FIELDS: { field: DealSheetField; label: string; dealKey: keyof Deal }[] = [
  { field: "company_name", label: "Company", dealKey: "company_name" },
  { field: "sector", label: "Sector", dealKey: "sector" },
  { field: "industry", label: "Industry", dealKey: "industry" },
  { field: "country", label: "Country", dealKey: "country" },
  { field: "source", label: "Source", dealKey: "source" },
  { field: "company_description", label: "Description", dealKey: "company_description" },
  { field: "latest_context", label: "Latest context", dealKey: "latest_context" },
  { field: "owners", label: "Owners", dealKey: "owners" },
  { field: "latest_sales", label: "Sales", dealKey: "latest_sales" },
  { field: "latest_ebitda", label: "EBITDA", dealKey: "latest_ebitda" },
  { field: "net_debt_cash", label: "ND/(Cash)", dealKey: "net_debt_cash" },
  { field: "financial_comments", label: "Financial comments", dealKey: "financial_comments" },
  { field: "entry_date", label: "Entry date", dealKey: "entry_date" },
];

const BOOL_FIELDS: { field: DealSheetField; label: string; dealKey: keyof Deal }[] = [
  { field: "nbo", label: "NBO", dealKey: "nbo" },
  { field: "dd", label: "DD", dealKey: "dd" },
  { field: "is_proprietary", label: "Proprietary", dealKey: "is_proprietary" },
];

export type ParsedImportRow = {
  rowNumber: number;
  fileIndex: number;
  action: "upsert" | "delete";
  crmId: string | null;
  invalidCrmId: boolean;
  companyName: string;
  unrecognizedTier: string | null;
  invalidIndustry: string | null;
  invalidEntryDate: boolean;
  values: Partial<Record<DealSheetField, string | boolean | DealTier | null>>;
};

export type ParsedDealSheet = {
  present: DealSheetField[];
  ignoredHeaders: string[];
  rows: ParsedImportRow[];
};

export type ImportChange = { label: string; before: string; after: string };

export type ImportMatch = "crm_id" | "name" | "manual" | "none";

export type ImportPreviewRow = {
  key: string;
  rowNumber: number;
  fileIndex: number;
  companyName: string;
  included: boolean;
  kind: "create" | "update" | "delete" | "unchanged" | "error";
  dealId: string | null;
  match: ImportMatch;
  note: string | null;
  needsChoice: boolean;
  boardFrom: DealTier | null;
  boardTo: DealTier | null;
  changes: ImportChange[];
  patch: Partial<Deal>;
  source: ParsedImportRow;
};

export type ImportPreview = {
  present: DealSheetField[];
  ignoredHeaders: string[];
  rows: ImportPreviewRow[];
};

export type ImportWrite =
  | { op: "delete"; id: string }
  | { op: "update"; id: string; patch: Partial<Deal> }
  | { op: "create"; patch: Partial<Deal> & { company_name: string } };

export type ImportRowSection = "review" | "delete" | "create" | "move" | "update" | "unchanged" | "error";

type SortDeal = {
  id: string;
  tier: string;
  archived?: boolean | null;
  sort_order?: number | null;
};

function stemToken(token: string) {
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** Lower-case key used to compare company names. Not the name that gets stored. */
export function companyMatchKey(value: string) {
  const folded = value
    .toLowerCase()
    .replace(PROPRIETARY_MARK, " ")
    .replace(EXCHANGE, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return folded.split(/\s+/).filter(Boolean).map(stemToken).join(" ");
}

/**
 * Full name, the text before the first parenthesis, and each parenthetical.
 * "deal-1 (Company A) [Proprietary]" matches "Company A".
 * A trailing s on a long word is folded so "Widgets" matches "Widget".
 */
export function companyMatchKeys(value: string) {
  const cleaned = value.replace(PROPRIETARY_MARK, " ").replace(EXCHANGE, " ");
  const keys = new Set<string>();
  const add = (part: string) => {
    const key = companyMatchKey(part);
    if (key.replace(/ /g, "").length >= 3) keys.add(key);
  };
  add(cleaned);
  for (const match of cleaned.matchAll(/\(([^)]+)\)/g)) add(match[1] ?? "");
  add(cleaned.split("(")[0] ?? "");
  return [...keys];
}

export function dealsMatchingName<T extends Pick<Deal, "id" | "company_name">>(deals: T[], companyName: string) {
  const wanted = new Set(companyMatchKeys(companyName));
  if (wanted.size === 0) return [];
  return deals.filter((deal) => companyMatchKeys(deal.company_name).some((key) => wanted.has(key)));
}

function show(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text || "—";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").trim() === (right ?? "").trim();
}

function dateKey(value: string | null | undefined) {
  if (!value) return "";
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value.trim();
}

function tierLabel(tier: DealTier) {
  return TIER_CONFIG[tier]?.label ?? tier;
}

function parseTierLabel(value: string): DealTier | null {
  const key = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  return TIER_LABELS[key] ?? null;
}

function isYes(value: string) {
  return /^(yes|y|true)$/i.test(value.trim());
}

function formatIsoDate(date: Date) {
  const utcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  const year = utcMidnight ? date.getUTCFullYear() : date.getFullYear();
  const month = (utcMidnight ? date.getUTCMonth() : date.getMonth()) + 1;
  const day = utcMidnight ? date.getUTCDate() : date.getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function excelSerialToDate(serial: number) {
  const utc = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (Number.isNaN(utc.getTime())) return null;
  return formatIsoDate(utc);
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : formatIsoDate(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Yes" : "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const record = value as { richText?: { text?: string }[]; text?: unknown; result?: unknown };
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => part?.text ?? "").join("").trim();
    }
    if ("result" in record && record.result != null) return cellText(record.result);
    if (typeof record.text === "string") return record.text.trim();
    if (record.text && typeof record.text === "object") return cellText(record.text);
  }
  return String(value).trim();
}

function parseEntryDate(value: unknown, text: string): { date: string | null; invalid: boolean } {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return { date: formatIsoDate(value), invalid: false };
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = excelSerialToDate(value);
    return { date, invalid: date == null };
  }
  const trimmed = text.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return { date: null, invalid: false };
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, invalid: false };
  const dayFirst = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dayFirst) return { date: `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`, invalid: false };
  return { date: null, invalid: true };
}

function blankText(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

/**
 * Read the first worksheet. Headers are matched by name.
 * Unknown columns (including "Partner note") are ignored. Cell fills are ignored.
 */
async function createWorkbook() {
  const loaded = (await import("exceljs")) as typeof import("exceljs") & { default?: typeof import("exceljs") };
  const ExcelJS = typeof loaded.Workbook === "function" ? loaded : loaded.default;
  if (!ExcelJS?.Workbook) throw new Error("Couldn't load the spreadsheet reader.");
  return new ExcelJS.Workbook();
}

export async function readDealSheet(data: ArrayBuffer | Uint8Array): Promise<ParsedDealSheet> {
  const workbook = await createWorkbook();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  await workbook.xlsx.load(copy.buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("That workbook has no sheets.");

  let headerRowNumber = 0;
  const columns = new Map<number, DealSheetColumn>();
  const ignoredHeaders: string[] = [];
  const scanUntil = Math.min(sheet.rowCount, 8);
  for (let rowNumber = 1; rowNumber <= scanUntil; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const found = new Map<number, DealSheetColumn>();
    const ignored: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const text = cellText(cell.value);
      if (!text) return;
      const column = columnForHeader(text);
      if (column) found.set(col, column);
      else ignored.push(text);
    });
    if ([...found.values()].includes("company_name")) {
      headerRowNumber = rowNumber;
      found.forEach((column, col) => columns.set(col, column));
      ignoredHeaders.push(...ignored);
      break;
    }
  }
  if (!headerRowNumber) throw new Error("This workbook doesn't have a Company Name column.");

  const presentSet = new Set<DealSheetField>();
  for (const column of columns.values()) {
    if (column !== "action") presentSet.add(column);
  }
  const present = DEAL_SHEET_COLUMNS.map((column) => column.key).filter((key) => presentSet.has(key));

  const rows: ParsedImportRow[] = [];
  let fileIndex = 0;
  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const raw = new Map<DealSheetColumn, { value: unknown; text: string }>();
    let any = false;
    for (const [col, column] of columns) {
      const value = row.getCell(col).value;
      const text = cellText(value);
      if (text) any = true;
      raw.set(column, { value, text });
    }
    if (!any) continue;

    const values: ParsedImportRow["values"] = {};
    let unrecognizedTier: string | null = null;
    let invalidIndustry: string | null = null;
    let invalidEntryDate = false;
    for (const field of present) {
      const cell = raw.get(field);
      const text = cell?.text ?? "";
      if (field === "tier") {
        const tier = parseTierLabel(text);
        values.tier = tier;
        if (text && !tier) unrecognizedTier = text;
      } else if (field === "nbo" || field === "dd" || field === "passed" || field === "is_proprietary") {
        values[field] = isYes(text);
      } else if (field === "entry_date") {
        const parsed = parseEntryDate(cell?.value, text);
        values.entry_date = parsed.date;
        invalidEntryDate = parsed.invalid;
      } else if (field === "industry") {
        const matched = matchIndustry(text);
        if (!text.trim()) values.industry = null;
        else if (matched) values.industry = matched;
        else invalidIndustry = text.trim();
      } else if (field === "id") {
        values.id = text ? text.trim() : null;
      } else if (field === "company_name") {
        values.company_name = blankText(text);
      } else {
        values[field] = blankText(text);
      }
    }

    const idText = raw.get("id")?.text?.trim() ?? "";
    const actionText = (raw.get("action")?.text ?? "").trim().toLowerCase();
    rows.push({
      rowNumber,
      fileIndex,
      action: actionText === "delete" ? "delete" : "upsert",
      crmId: UUID.test(idText) ? idText.toLowerCase() : null,
      invalidCrmId: Boolean(idText) && !UUID.test(idText),
      companyName: blankText(raw.get("company_name")?.text ?? "") ?? "",
      unrecognizedTier,
      invalidIndustry,
      invalidEntryDate,
      values,
    });
    fileIndex += 1;
  }

  return { present, ignoredHeaders, rows };
}

function boardFor(present: Set<DealSheetField>, row: ParsedImportRow, current: Deal | null): DealTier | undefined {
  const hasTier = present.has("tier");
  const hasPassed = present.has("passed");
  if (!hasTier && !hasPassed) return current ? undefined : "pipeline";
  const labelled = hasTier ? ((row.values.tier as DealTier | null) ?? null) : null;
  const passedYes = hasPassed && row.values.passed === true;
  if (passedYes) return "passed";
  if (labelled) return labelled;
  if (hasPassed && !hasTier && current?.tier === "passed") return "pipeline";
  return current?.tier ?? "pipeline";
}

function applyTextField(
  patch: Partial<Deal>,
  changes: ImportChange[],
  field: (typeof TEXT_FIELDS)[number],
  row: ParsedImportRow,
  current: Deal | null,
) {
  const next = (row.values[field.field] as string | null) ?? null;
  if (field.field === "company_name") {
    if (!next) return;
    if (current && sameText(current.company_name, next)) return;
    patch.company_name = next;
    changes.push({ label: field.label, before: show(current?.company_name), after: next });
    return;
  }
  const previous = current ? (current[field.dealKey] as string | null) : null;
  const same = field.field === "entry_date" ? dateKey(previous) === dateKey(next) : sameText(previous, next);
  if (current && same) return;
  if (!current && next == null) return;
  (patch as Record<string, unknown>)[field.dealKey] = next;
  changes.push({
    label: field.label,
    before: show(field.field === "entry_date" ? dateKey(previous) : previous),
    after: show(field.field === "entry_date" ? dateKey(next) : next),
  });
}

function applyBoolField(
  patch: Partial<Deal>,
  changes: ImportChange[],
  field: (typeof BOOL_FIELDS)[number],
  row: ParsedImportRow,
  current: Deal | null,
) {
  const next = row.values[field.field] === true;
  const previous = current ? current[field.dealKey] === true : false;
  if (current && previous === next) return;
  if (!current && !next && field.field !== "is_proprietary") return;
  if (!current && field.field === "is_proprietary") {
    patch.is_proprietary = next;
    if (next) changes.push({ label: field.label, before: "—", after: "Yes" });
    return;
  }
  (patch as Record<string, unknown>)[field.dealKey] = next;
  changes.push({ label: field.label, before: current ? yesNo(previous) : "—", after: yesNo(next) });
}

function applyBoard(
  patch: Partial<Deal>,
  changes: ImportChange[],
  current: Deal | null,
  nextTier: DealTier | undefined,
  now: string,
) {
  if (!nextTier) return { from: current?.tier ?? null, to: current?.tier ?? null };
  if (!current || current.tier !== nextTier) {
    patch.tier = nextTier;
    changes.push({ label: "Board", before: current ? tierLabel(current.tier) : "—", after: tierLabel(nextTier) });
  }
  const onPassed = nextTier === "passed";
  const uiBefore = current?.is_passed === true;
  const legacyBefore = current?.passed === true;
  if (!current || uiBefore !== onPassed || legacyBefore !== onPassed) {
    patch.is_passed = onPassed;
    patch.passed = onPassed;
    patch.passed_at = onPassed ? current?.passed_at ?? now : null;
    if (!current) {
      if (onPassed) changes.push({ label: "Passed", before: "—", after: "Yes" });
    } else if (uiBefore !== onPassed) {
      changes.push({ label: "Passed", before: yesNo(uiBefore), after: yesNo(onPassed) });
    } else {
      changes.push({ label: "Passed", before: yesNo(legacyBefore), after: yesNo(onPassed) });
    }
  }
  return { from: current?.tier ?? null, to: nextTier };
}

function applyPassReason(patch: Partial<Deal>, changes: ImportChange[], row: ParsedImportRow, current: Deal | null) {
  const next = (row.values.pass_reason as string | null) ?? null;
  const previousUi = current?.passed_reason ?? null;
  const previousLegacy = current?.pass_reason ?? null;
  if (current && sameText(previousUi, next) && sameText(previousLegacy, next)) return;
  if (!current && next == null) return;
  patch.pass_reason = next;
  patch.passed_reason = next;
  const before = (previousUi ?? previousLegacy ?? "").trim();
  changes.push({ label: "Pass reason", before: show(before), after: show(next) });
}

/**
 * Build the patch for columns that are actually in the file.
 * Latest Context writes latest_context only. Passed writes is_passed and passed,
 * and Pass Reason writes passed_reason and pass_reason, so the screen and the
 * export stay in agreement. source_type and latest_update are never touched.
 */
export function patchForRow(row: ParsedImportRow, present: DealSheetField[], current: Deal | null, now: string) {
  const presentSet = new Set(present);
  const patch: Partial<Deal> = {};
  const changes: ImportChange[] = [];
  const notes: string[] = [];

  if (row.unrecognizedTier) notes.push(`Tier “${row.unrecognizedTier}” wasn’t recognised and was left unchanged.`);
  if (row.invalidIndustry) notes.push(`Industry “${row.invalidIndustry}” isn’t on the list, so that field was left unchanged.`);
  if (row.invalidEntryDate) notes.push("Entry date wasn’t a date, so that field was left unchanged.");
  if (presentSet.has("company_name") && !row.companyName && current) notes.push("Blank company name left unchanged.");

  for (const field of TEXT_FIELDS) {
    if (!presentSet.has(field.field)) continue;
    if (field.field === "entry_date" && row.invalidEntryDate) continue;
    if (field.field === "industry" && row.invalidIndustry) continue;
    applyTextField(patch, changes, field, row, current);
  }
  for (const field of BOOL_FIELDS) {
    if (!presentSet.has(field.field)) continue;
    applyBoolField(patch, changes, field, row, current);
  }
  if (presentSet.has("pass_reason")) applyPassReason(patch, changes, row, current);

  const nextTier = boardFor(presentSet, row, current);
  const board = applyBoard(patch, changes, current, nextTier, now);
  return { patch, changes, board, notes };
}

function errorRow(row: ParsedImportRow, note: string): ImportPreviewRow {
  return {
    key: `row-${row.rowNumber}`,
    rowNumber: row.rowNumber,
    fileIndex: row.fileIndex,
    companyName: row.companyName || "Untitled row",
    included: false,
    kind: "error",
    dealId: null,
    match: "none",
    note,
    needsChoice: false,
    boardFrom: null,
    boardTo: null,
    changes: [],
    patch: {},
    source: row,
  };
}

function previewRow(
  row: ParsedImportRow,
  present: DealSheetField[],
  current: Deal | null,
  match: ImportMatch,
  note: string | null,
  needsChoice: boolean,
  included: boolean,
  now: string,
  kindOverride?: ImportPreviewRow["kind"],
): ImportPreviewRow {
  if (!current && !row.companyName) {
    return errorRow(row, "This row has no company name, so it can’t be created.");
  }
  const built = patchForRow(row, present, current, now);
  const notes = [note, ...built.notes].filter(Boolean).join(" ");
  const empty = built.changes.length === 0 && Object.keys(built.patch).length === 0;
  let kind: ImportPreviewRow["kind"] = kindOverride ?? (current ? "update" : "create");
  if (kind === "update" && empty) kind = "unchanged";
  return {
    key: `row-${row.rowNumber}`,
    rowNumber: row.rowNumber,
    fileIndex: row.fileIndex,
    companyName: row.companyName || current?.company_name || "Untitled row",
    included: kind === "unchanged" || kind === "error" ? false : included,
    kind,
    dealId: current?.id ?? null,
    match,
    note: notes || null,
    needsChoice,
    boardFrom: built.board.from,
    boardTo: built.board.to,
    changes: built.changes,
    patch: built.patch,
    source: row,
  };
}

export function buildImportPreview(sheet: ParsedDealSheet, deals: Deal[], now = new Date().toISOString()): ImportPreview {
  const byId = new Map(deals.map((deal) => [deal.id.toLowerCase(), deal]));
  const claimed = new Set<string>();
  const rows = sheet.rows.map((row) => {
    if (row.action === "delete") {
      if (row.invalidCrmId) return errorRow(row, "Delete only matches a CRM ID, and this CRM ID isn’t a deal id.");
      if (!row.crmId) return errorRow(row, "Delete only matches a CRM ID. This row has none, so nothing will be deleted.");
      const deal = byId.get(row.crmId);
      if (!deal) return errorRow(row, "No deal has this CRM ID, so nothing will be deleted.");
      claimed.add(deal.id);
      return {
        ...previewRow(row, [], deal, "crm_id", null, false, true, now, "delete"),
        kind: "delete" as const,
        included: true,
        companyName: row.companyName || deal.company_name,
        changes: [],
        patch: {},
        boardFrom: deal.tier,
        boardTo: null,
        note: row.companyName && companyMatchKey(row.companyName) !== companyMatchKey(deal.company_name)
          ? `Deletes ${deal.company_name}. The company name in the file is different and is not used to find the deal.`
          : `Deletes ${deal.company_name}.`,
      };
    }

    let current: Deal | null = null;
    let match: ImportMatch = "none";
    let note: string | null = null;
    let needsChoice = false;
    let included = true;

    if (row.invalidCrmId) note = "CRM ID isn’t a deal id, so this row was matched by name.";
    if (row.crmId) {
      const found = byId.get(row.crmId) ?? null;
      if (found) {
        current = found;
        match = "crm_id";
      } else {
        note = "CRM ID was not found.";
      }
    }

    if (!current) {
      const hits = dealsMatchingName(deals, row.companyName);
      if (hits.length === 1) {
        current = hits[0];
        match = "name";
        note = note ? `${note} Matched by company name.` : null;
      } else if (hits.length > 1) {
        needsChoice = true;
        included = false;
        note = "This name matches more than one deal. Choose one, or create a new deal.";
      } else if (note === "CRM ID was not found.") {
        note = "CRM ID was not found. This will be a new deal.";
      }
    }

    if (current && claimed.has(current.id)) {
      needsChoice = true;
      included = false;
      note = `An earlier row already matches ${current.company_name}. This row is left out so it doesn’t overwrite that one. Include it to apply this row instead, or create a new deal.`;
    } else if (current) {
      claimed.add(current.id);
    }

    return previewRow(row, sheet.present, current, match, note, needsChoice, included, now);
  });

  return { present: sheet.present, ignoredHeaders: sheet.ignoredHeaders, rows };
}

export function retargetImportRow(preview: ImportPreview, key: string, choice: "new" | string, deals: Deal[], now = new Date().toISOString()): ImportPreview {
  return {
    ...preview,
    rows: preview.rows.map((row) => {
      if (row.key !== key || row.source.action === "delete") return row;
      if (choice === "new") {
        const next = previewRow(row.source, preview.present, null, "manual", "Will create a new deal.", false, true, now);
        return next;
      }
      const deal = deals.find((item) => item.id === choice);
      if (!deal) return row;
      const crowded = preview.rows.some((item) => item.key !== key && item.included && item.dealId === deal.id && item.kind !== "error");
      const note = crowded ? "Another included row also updates this deal. If you include both, the later row wins." : null;
      return previewRow(row.source, preview.present, deal, "manual", note, false, true, now);
    }),
  };
}

export function importRowSection(row: ImportPreviewRow): ImportRowSection {
  if (row.kind === "error") return "error";
  if (row.needsChoice) return "review";
  if (row.kind === "delete") return "delete";
  if (row.kind === "create") return "create";
  if (row.kind === "unchanged") return "unchanged";
  if (row.boardFrom && row.boardTo && row.boardFrom !== row.boardTo) return "move";
  return "update";
}

type Placement = { key: string; tier: DealTier; fileIndex: number; dealId: string | null };

/** First file row on a board gets the smallest sort_order, so it sits at the top. */
export function landingSortOrders(deals: SortDeal[], placements: Placement[], deletedIds: Set<string>) {
  const movingIds = new Set(placements.map((item) => item.dealId).filter((id): id is string => !!id));
  const byTier = new Map<DealTier, Placement[]>();
  for (const placement of placements) {
    const list = byTier.get(placement.tier) ?? [];
    list.push(placement);
    byTier.set(placement.tier, list);
  }
  const orders = new Map<string, number>();
  for (const [tier, list] of byTier) {
    list.sort((left, right) => left.fileIndex - right.fileIndex);
    const staying: number[] = [];
    for (const deal of deals) {
      if (deal.archived === true || deal.tier !== tier || deletedIds.has(deal.id) || movingIds.has(deal.id)) continue;
      if (typeof deal.sort_order === "number" && Number.isFinite(deal.sort_order)) staying.push(deal.sort_order);
    }
    const count = list.length;
    const minimum = staying.length > 0 ? Math.min(...staying) : count;
    list.forEach((item, index) => orders.set(item.key, minimum - count + index));
  }
  return orders;
}

/** Included rows only. Nothing here writes to the database. */
export function planImportWrites(preview: ImportPreview, deals: Deal[]): ImportWrite[] {
  const included = preview.rows.filter((row) => row.included && row.kind !== "error" && row.kind !== "unchanged");
  const deletes = included.filter((row) => row.kind === "delete" && row.dealId);
  const deletedIds = new Set(deletes.map((row) => row.dealId as string));

  const updateById = new Map<string, ImportPreviewRow>();
  for (const row of included) {
    if (row.kind !== "update" || !row.dealId || deletedIds.has(row.dealId)) continue;
    const previous = updateById.get(row.dealId);
    if (!previous || row.fileIndex >= previous.fileIndex) updateById.set(row.dealId, row);
  }
  const creates = included.filter((row): row is ImportPreviewRow & { patch: Partial<Deal> & { company_name: string } } => {
    return row.kind === "create" && typeof row.patch.company_name === "string" && row.patch.company_name.trim() !== "";
  });

  const placements: Placement[] = [];
  for (const row of updateById.values()) {
    const current = deals.find((deal) => deal.id === row.dealId);
    const nextTier = (row.patch.tier as DealTier | undefined) ?? current?.tier;
    if (current && nextTier && nextTier !== current.tier && row.dealId) {
      placements.push({ key: row.dealId, tier: nextTier, fileIndex: row.fileIndex, dealId: row.dealId });
    }
  }
  for (const row of creates) {
    placements.push({
      key: row.key,
      tier: (row.patch.tier as DealTier | undefined) ?? "pipeline",
      fileIndex: row.fileIndex,
      dealId: null,
    });
  }
  const orders = landingSortOrders(deals, placements, deletedIds);
  const byDeal = new Map(deals.map((deal) => [deal.id, deal]));

  const writes: ImportWrite[] = [];
  for (const row of deletes.sort((left, right) => left.fileIndex - right.fileIndex)) {
    if (row.dealId) writes.push({ op: "delete", id: row.dealId });
  }
  const updates = [...updateById.values()].sort((left, right) => left.fileIndex - right.fileIndex);
  for (const row of updates) {
    if (!row.dealId) continue;
    const current = byDeal.get(row.dealId);
    const patch: Partial<Deal> = { ...row.patch };
    const sortOrder = orders.get(row.dealId);
    if (sortOrder != null) patch.sort_order = sortOrder;
    if (Object.keys(patch).length === 0) continue;
    writes.push({ op: "update", id: row.dealId, patch });
  }
  for (const row of creates.sort((left, right) => left.fileIndex - right.fileIndex)) {
    const patch: Partial<Deal> & { company_name: string } = { ...row.patch, company_name: row.patch.company_name };
    patch.tier = patch.tier ?? "pipeline";
    patch.sort_order = orders.get(row.key) ?? 0;
    writes.push({ op: "create", patch });
  }
  return writes;
}
