"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TIER_CONFIG } from "@/lib/constants";
import {
  buildImportPreview,
  importRowSection,
  planImportWrites,
  readDealSheet,
  retargetImportRow,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportRowSection,
} from "@/lib/import-deals";
import type { Deal } from "@/types/database";

const SECTIONS: { id: ImportRowSection; title: string }[] = [
  { id: "review", title: "Needs a decision" },
  { id: "delete", title: "Deals to delete" },
  { id: "create", title: "New deals" },
  { id: "move", title: "Board moves" },
  { id: "update", title: "Field changes" },
  { id: "error", title: "Rows that won’t be applied" },
];

export function ImportDealsButton() {
  const { deals, applyImport, notify } = useCrm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFile = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const sheet = await readDealSheet(await file.arrayBuffer());
      setFileName(file.name);
      setPreview(buildImportPreview(sheet, deals));
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : "Couldn't read that workbook.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const close = () => {
    if (applying) return;
    setPreview(null);
    setError(null);
  };

  const apply = async () => {
    if (!preview) return;
    const writes = planImportWrites(preview, deals);
    if (writes.length === 0) return;
    setApplying(true);
    setError(null);
    const message = await applyImport(writes);
    setApplying(false);
    if (message) {
      setError(message);
      return;
    }
    notify(`Imported ${writes.length} ${writes.length === 1 ? "change" : "changes"}`);
    setPreview(null);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        aria-label="Import workbook"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <button
        type="button"
        className="press inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs"
        onClick={openFile}
        disabled={reading}
      >
        <Upload className="size-3.5" />
        {reading ? "Reading…" : "Import"}
      </button>
      <Dialog open={preview != null || error != null} onOpenChange={(next) => !next && close()}>
        <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[calc(100%-1rem)] max-w-3xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Import preview</DialogTitle>
            <DialogDescription>
              {fileName ? `${fileName}. ` : ""}Nothing is written until you apply. A blank cell clears that column. Columns that aren’t in the file stay as they are.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {preview && (
            <PreviewBody
              preview={preview}
              deals={deals}
              applying={applying}
              onChange={setPreview}
              onApply={() => void apply()}
              onClose={close}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PreviewBody({
  preview,
  deals,
  applying,
  onChange,
  onApply,
  onClose,
}: {
  preview: ImportPreview;
  deals: Deal[];
  applying: boolean;
  onChange: (preview: ImportPreview) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const included = preview.rows.filter((row) => row.included);
  const setIncluded = (key: string, value: boolean) => {
    onChange({
      ...preview,
      rows: preview.rows.map((row) => (row.key === key && row.kind !== "unchanged" ? { ...row, included: value } : row)),
    });
  };
  const setAll = (value: boolean) => {
    onChange({
      ...preview,
      rows: preview.rows.map((row) => (row.kind === "unchanged" || row.kind === "error" ? row : { ...row, included: value })),
    });
  };
  const retarget = (key: string, choice: string) => {
    onChange(retargetImportRow(preview, key, choice === "new" ? "new" : choice, deals));
  };

  const unchanged = preview.rows.filter((row) => importRowSection(row) === "unchanged");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{included.length} included</span>
        <button type="button" className="underline" onClick={() => setAll(true)}>Include all</button>
        <button type="button" className="underline" onClick={() => setAll(false)}>Exclude all</button>
        {preview.ignoredHeaders.length > 0 && <span>Ignored columns: {preview.ignoredHeaders.join(", ")}</span>}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {SECTIONS.map((section) => {
          const rows = preview.rows.filter((row) => importRowSection(row) === section.id);
          if (rows.length === 0) return null;
          return (
            <section key={section.id}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {section.title} <span className="tabular-nums">{rows.length}</span>
              </h3>
              <ul className="mt-2 space-y-2">
                {rows.map((row) => (
                  <PreviewCard
                    key={row.key}
                    row={row}
                    deals={deals}
                    onIncluded={(value) => setIncluded(row.key, value)}
                    onRetarget={(choice) => retarget(row.key, choice)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {unchanged.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{unchanged.length} rows already match and will be skipped</summary>
            <ul className="mt-2 space-y-1">
              {unchanged.map((row) => <li key={row.key}>{row.companyName}</li>)}
            </ul>
          </details>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={applying}>Cancel</Button>
        <Button type="button" onClick={onApply} disabled={applying || included.length === 0}>
          {applying ? "Applying…" : `Apply ${included.length}`}
        </Button>
      </div>
    </>
  );
}

function PreviewCard({
  row,
  deals,
  onIncluded,
  onRetarget,
}: {
  row: ImportPreviewRow;
  deals: Deal[];
  onIncluded: (value: boolean) => void;
  onRetarget: (choice: string) => void;
}) {
  const matched = deals.find((deal) => deal.id === row.dealId);
  const showChoices = row.source.action !== "delete" && (row.needsChoice || row.kind === "create" || row.match === "manual" || row.match === "none");
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={row.included}
          disabled={row.kind === "error"}
          aria-label={`Include ${row.companyName}`}
          onChange={(event) => onIncluded(event.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{row.companyName}</p>
          <p className="text-[11px] text-muted-foreground">
            Row {row.rowNumber}
            {matched ? ` · ${matched.company_name}` : ""}
            {row.kind === "delete" ? " · Delete" : ""}
            {row.boardFrom && row.boardTo && row.boardFrom !== row.boardTo ? ` · ${TIER_CONFIG[row.boardFrom].label} → ${TIER_CONFIG[row.boardTo].label}` : ""}
          </p>
          {row.note && <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>}
          {row.changes.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.changes.map((change) => (
                <li key={change.label} className="text-xs leading-5">
                  <span className="text-muted-foreground">{change.label}: </span>
                  <span className="line-clamp-3 whitespace-pre-wrap break-words">{change.before} → {change.after}</span>
                </li>
              ))}
            </ul>
          )}
          {row.kind === "create" || row.kind === "update" ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {row.boardTo && (row.kind === "create" || row.boardFrom !== row.boardTo) ? `Lands at the top of ${TIER_CONFIG[row.boardTo].label}.` : ""}
            </p>
          ) : null}
          {showChoices && (
            <label className="mt-2 block text-[11px] text-muted-foreground">
              Match
              <select
                className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                value={row.kind === "create" ? "new" : row.dealId ?? "new"}
                aria-label={`Match ${row.companyName}`}
                onChange={(event) => onRetarget(event.target.value)}
              >
                <option value="new">Create new</option>
                {deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>{deal.company_name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </li>
  );
}
