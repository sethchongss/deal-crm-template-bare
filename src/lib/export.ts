import type { Deal } from "@/types/database";
import { TIER_CONFIG } from "@/lib/constants";
import { DEAL_SHEET_COLUMNS, exportCell } from "@/lib/deal-sheet";

export async function exportDealsToExcel(deals: Deal[], filename = "deal-pipeline.xlsx") {
  const loaded = (await import("exceljs")) as typeof import("exceljs") & { default?: typeof import("exceljs") };
  const ExcelJS = typeof loaded.Workbook === "function" ? loaded : loaded.default;
  if (!ExcelJS?.Workbook) throw new Error("Couldn't load the spreadsheet reader.");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Deal Pipeline");

  ws.columns = DEAL_SHEET_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  // Style header
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1F4E79" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };

  deals.forEach((deal) => {
    const row: Record<string, string> = {};
    for (const column of DEAL_SHEET_COLUMNS) {
      row[column.key] = column.key === "tier" ? TIER_CONFIG[deal.tier]?.label || deal.tier : exportCell(deal, column.key);
    }
    ws.addRow(row);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
