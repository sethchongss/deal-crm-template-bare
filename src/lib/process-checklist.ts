import type { DealTask, DealTier, DealWorkstream } from "@/types/database";

/**
 * The investment-process checklist. Each step is a workstream on the deal;
 * its tasks are the checklist items. Workstreams with other names are shown
 * under "Other workstreams" and still count toward progress.
 */
export const PROCESS_STEPS: { key: string; name: string; aliases: string[]; tasks: string[] }[] = [
  { key: "screening", name: "Screening", aliases: ["screen", "screening"], tasks: ["Teaser reviewed", "Preliminary screen written"] },
  { key: "first-call", name: "First call", aliases: ["first call", "intro call", "management call"], tasks: ["First call held", "Call notes shared"] },
  { key: "nda", name: "NDA", aliases: ["nda", "confidentiality"], tasks: ["NDA signed", "Information memorandum received"] },
  { key: "model", name: "Model", aliases: ["model", "financial model", "modelling", "modeling"], tasks: ["Operating model built", "Returns case agreed"] },
  { key: "dd", name: "Due diligence", aliases: ["dd", "due diligence", "diligence"], tasks: ["Commercial diligence", "Financial diligence", "Legal diligence"] },
  { key: "ic", name: "IC", aliases: ["ic", "investment committee", "ic approval"], tasks: ["IC paper drafted", "IC approval"] },
  { key: "close", name: "Close", aliases: ["close", "closing", "signing", "completion"], tasks: ["SPA signed", "Completion"] },
];

export type ChecklistTask = Pick<DealTask, "status">;

export type Progress = { done: number; total: number; percent: number };

export function checklistProgress(tasks: ChecklistTask[]): Progress {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function stepForWorkstream(name: string | null | undefined) {
  const key = (name ?? "").trim().toLowerCase();
  if (!key) return null;
  return PROCESS_STEPS.find((step) => step.name.toLowerCase() === key || step.aliases.includes(key)) ?? null;
}

export type ChecklistGroup<T extends Pick<DealTask, "workstream_id" | "status" | "sort_order">> = {
  key: string;
  name: string;
  index: number | null;
  workstreams: DealWorkstream[];
  tasks: T[];
  progress: Progress;
};

/** Groups a deal's workstreams and tasks by process step, in process order. */
export function groupChecklist<T extends Pick<DealTask, "workstream_id" | "status" | "sort_order">>(
  workstreams: DealWorkstream[],
  tasks: T[],
): { steps: ChecklistGroup<T>[]; other: ChecklistGroup<T> | null } {
  const byStep = new Map<string, DealWorkstream[]>();
  const other: DealWorkstream[] = [];
  for (const stream of [...workstreams].sort((a, b) => a.sort_order - b.sort_order)) {
    const step = stepForWorkstream(stream.name);
    if (step) byStep.set(step.key, [...(byStep.get(step.key) ?? []), stream]);
    else other.push(stream);
  }
  const group = (key: string, name: string, index: number | null, streams: DealWorkstream[]): ChecklistGroup<T> => {
    const ids = new Set(streams.map((stream) => stream.id));
    const own = tasks.filter((task) => ids.has(task.workstream_id)).sort((a, b) => a.sort_order - b.sort_order);
    return { key, name, index, workstreams: streams, tasks: own, progress: checklistProgress(own) };
  };
  return {
    steps: PROCESS_STEPS.map((step, index) => group(step.key, step.name, index, byStep.get(step.key) ?? [])),
    other: other.length > 0 ? group("other", "Other workstreams", null, other) : null,
  };
}

/** Name of the first process step that still has open items, or null when all are done. */
export function currentStep(steps: ChecklistGroup<Pick<DealTask, "workstream_id" | "status" | "sort_order">>[]) {
  const open = steps.find((step) => step.progress.total > 0 && step.progress.done < step.progress.total);
  return open?.name ?? null;
}

/** Soft colour per board. Values are CSS custom properties from globals.css. */
export const BOARD_SOFT: Record<DealTier, { card: string; column: string; chip: string; bar: string; track: string }> = {
  active: {
    card: "bg-[var(--soft-active-card)] border-[var(--soft-active-border)]",
    column: "bg-[var(--soft-active-column)]",
    chip: "bg-[var(--soft-active-chip)] text-[var(--soft-active-ink)]",
    bar: "bg-[var(--soft-active-ink)]",
    track: "bg-[var(--soft-active-track)]",
  },
  pipeline: {
    card: "bg-[var(--soft-pipeline-card)] border-[var(--soft-pipeline-border)]",
    column: "bg-[var(--soft-pipeline-column)]",
    chip: "bg-[var(--soft-pipeline-chip)] text-[var(--soft-pipeline-ink)]",
    bar: "bg-[var(--soft-pipeline-ink)]",
    track: "bg-[var(--soft-pipeline-track)]",
  },
  passed: {
    card: "bg-[var(--soft-passed-card)] border-[var(--soft-passed-border)]",
    column: "bg-[var(--soft-passed-column)]",
    chip: "bg-[var(--soft-passed-chip)] text-[var(--soft-passed-ink)]",
    bar: "bg-[var(--soft-passed-ink)]",
    track: "bg-[var(--soft-passed-track)]",
  },
};
