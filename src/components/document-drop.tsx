"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import type { ExtractedDeal } from "@/lib/extract-deal";

export function DocumentDrop({ onExtracted }: { onExtracted: (deal: ExtractedDeal, fields: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/extract-deal", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Couldn't read that document.");
        return;
      }
      const deal = payload.deal as ExtractedDeal;
      const fields = Object.entries(deal).filter(([, value]) => value != null && value !== "").map(([key]) => key);
      onExtracted(deal, fields);
    } catch {
      setError("Couldn't reach document reading. You can still fill the form by hand.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-secondary px-4 py-6 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) void read(file);
        }}
      >
        <Upload className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium">{busy ? "Reading the document…" : "Drop a teaser, IM, or CIM"}</span>
        <span className="text-xs text-muted-foreground">PDF or Word (.docx), up to 12MB. Nothing is saved until you create the deal.</span>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
            event.target.value = "";
          }}
        />
      </label>
      {error && (
        <p className="mt-2 flex items-start gap-2 text-xs text-destructive" role="alert">
          <FileText className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
