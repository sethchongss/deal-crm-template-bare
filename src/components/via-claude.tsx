"use client";

import { useState } from "react";
import { Tag } from "@/components/tag";
import { useCrm } from "@/components/crm-provider";

export function ViaClaude({ auditId, actor, stop = false }: { auditId: string; actor: string | null; stop?: boolean }) {
  const { undoClaudeChange } = useCrm();
  const [busy, setBusy] = useState(false);

  return (
    <span className="inline-flex items-center gap-1.5">
      <Tag tone="purple">via Claude{actor ? ` · ${actor}` : ""}</Tag>
      <button
        type="button"
        className="text-[11px] font-medium text-muted-foreground underline decoration-border underline-offset-2 hoverable:hover:text-foreground disabled:opacity-50"
        disabled={busy}
        onPointerDown={stop ? (event) => event.stopPropagation() : undefined}
        onClick={(event) => {
          if (stop) event.stopPropagation();
          setBusy(true);
          void undoClaudeChange(auditId).then((ok) => {
            if (!ok) setBusy(false);
          });
        }}
      >
        {busy ? "Undoing…" : "Undo"}
      </button>
    </span>
  );
}
