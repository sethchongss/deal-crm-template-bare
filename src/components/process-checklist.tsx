"use client";

import { Check, Circle, CircleDot, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BOARD_SOFT, PROCESS_STEPS, currentStep, groupChecklist, checklistProgress } from "@/lib/process-checklist";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DealTask, DealTier, DealWorkstream } from "@/types/database";

type Props = {
  tier: DealTier;
  workstreams: DealWorkstream[];
  tasks: DealTask[];
  onToggle: (task: DealTask) => Promise<boolean>;
  onAddItem: (stepName: string, title: string) => Promise<boolean>;
  onStart: () => Promise<boolean>;
};

function StepItem({ task, onToggle, soft }: { task: DealTask; onToggle: (task: DealTask) => Promise<boolean>; soft: (typeof BOARD_SOFT)[DealTier] }) {
  const [busy, setBusy] = useState(false);
  const done = task.status === "done";
  return (
    <li>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onToggle(task);
          setBusy(false);
        }}
        className="press flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left hoverable:hover:bg-background/70"
        aria-pressed={done}
      >
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
            done ? cn("border-transparent text-background", soft.bar) : "border-border bg-background",
          )}
        >
          {done && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className={cn("min-w-0 flex-1 text-sm", done && "text-muted-foreground line-through decoration-1")}>{task.title}</span>
        {!done && task.status !== "not_started" && (
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", soft.chip)}>{TASK_STATUS_LABEL[task.status]}</span>
        )}
        {task.owner && <span className="shrink-0 text-[11px] text-muted-foreground">{task.owner}</span>}
      </button>
    </li>
  );
}

function AddItem({ onAdd }: { onAdd: (title: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open) {
    return (
      <button type="button" className="press mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-muted-foreground hoverable:hover:bg-background/70" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> Add item
      </button>
    );
  }
  const submit = async () => {
    const next = title.trim();
    if (!next) return setOpen(false);
    if (await onAdd(next)) {
      setTitle("");
      setOpen(false);
    }
  };
  return (
    <div className="mt-1 flex gap-2 px-1">
      <input
        autoFocus
        className="h-8 min-w-0 flex-1 rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:shadow-focus"
        placeholder="New checklist item"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
          if (event.key === "Escape") setOpen(false);
        }}
      />
      <Button type="button" size="sm" onClick={() => void submit()}>Add</Button>
    </div>
  );
}

export function ProcessChecklist({ tier, workstreams, tasks, onToggle, onAddItem, onStart }: Props) {
  const soft = BOARD_SOFT[tier];
  const { steps, other } = groupChecklist(workstreams, tasks);
  const overall = checklistProgress(tasks);
  const now = currentStep(steps);
  const missing = steps.filter((step) => step.workstreams.length === 0).length;
  const [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  return (
    <section id="investment-checklist" className={cn("rounded-[28px] border p-4 md:p-5", soft.card)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Project management</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-[-0.02em]">Investment checklist</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {overall.total === 0 ? "No checklist items yet." : now ? `Now: ${now}` : "Every step is done."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums tracking-[-0.03em]">{overall.percent}%</p>
          <p className="text-[12px] tabular-nums text-muted-foreground">{overall.done} of {overall.total} done</p>
        </div>
      </div>
      <div className={cn("mt-3 h-2.5 overflow-hidden rounded-full", soft.track)}>
        <div className={cn("h-full rounded-full transition-[width] duration-500 ease-power4-out", soft.bar)} style={{ width: `${overall.percent}%` }} />
      </div>

      {missing > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background/70 px-3 py-2">
          <p className="text-[13px] text-muted-foreground">
            {missing === PROCESS_STEPS.length ? "Start the standard process: screening to close." : `${missing} step${missing === 1 ? "" : "s"} not set up yet.`}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              await onStart();
              setStarting(false);
            }}
          >
            {starting ? "Adding…" : missing === PROCESS_STEPS.length ? "Start checklist" : "Add missing steps"}
          </Button>
        </div>
      )}

      <ol className="mt-4 space-y-2.5">
        {steps.map((step) => {
          const complete = step.progress.total > 0 && step.progress.done === step.progress.total;
          const active = step.name === now;
          return (
            <li key={step.key} className={cn("rounded-3xl bg-background/55 p-3", active && "ring-2 ring-[color:var(--border)]")}>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold",
                    complete ? cn("text-background", soft.bar) : soft.chip,
                  )}
                >
                  {complete ? <Check className="size-4" strokeWidth={3} /> : (step.index ?? 0) + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{step.name}</h3>
                    {active && (
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", soft.chip)}>
                        <CircleDot className="size-3" /> In progress
                      </span>
                    )}
                  </div>
                  <div className={cn("mt-1.5 h-1.5 overflow-hidden rounded-full", soft.track)}>
                    <div className={cn("h-full rounded-full", soft.bar)} style={{ width: `${step.progress.percent}%` }} />
                  </div>
                </div>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">
                  {step.progress.total === 0 ? "—" : `${step.progress.done}/${step.progress.total}`}
                </span>
              </div>
              {complete && !expanded.includes(step.key) ? (
                <button
                  type="button"
                  className="press ml-9 mt-1.5 rounded-full px-2.5 py-1 text-[12px] text-muted-foreground hoverable:hover:bg-background/70"
                  onClick={() => setExpanded((current) => [...current, step.key])}
                >
                  Show {step.progress.done} done item{step.progress.done === 1 ? "" : "s"}
                </button>
              ) : (
                <>
                  {step.tasks.length > 0 && (
                    <ul className="mt-2 space-y-0.5 pl-8">
                      {step.tasks.map((task) => <StepItem key={task.id} task={task} onToggle={onToggle} soft={soft} />)}
                    </ul>
                  )}
                  {step.workstreams.length > 0 && (
                    <div className="pl-9">
                      <AddItem onAdd={(title) => onAddItem(step.name, title)} />
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
        {other && (
          <li className="rounded-3xl bg-background/55 p-3">
            <div className="flex items-center gap-3">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", soft.chip)}>
                <Circle className="size-3.5" />
              </span>
              <h3 className="min-w-0 flex-1 text-[15px] font-semibold tracking-[-0.01em]">{other.name}</h3>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">{other.progress.done}/{other.progress.total}</span>
            </div>
            {other.tasks.length > 0 && (
              <ul className="mt-2 space-y-0.5 pl-8">
                {other.tasks.map((task) => <StepItem key={task.id} task={task} onToggle={onToggle} soft={soft} />)}
              </ul>
            )}
          </li>
        )}
      </ol>
    </section>
  );
}
