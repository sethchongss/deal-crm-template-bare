"use client";

import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { Plus, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { TaskAssignee } from "@/components/task-assignee";
import { TaskDates } from "@/components/task-dates";
import { TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import { dragTaskDates } from "@/lib/task-dates";
import type { Deal, DealTask, DealWorkstream, TaskStatus } from "@/types/database";
import { cn } from "@/lib/utils";

const WEEK = 72;
const DAY = WEEK / 7;
const PANE_KEY = "gantt-pane-width";
const PANE_MIN = 560;
const PANE_MAX = 960;

function parseDay(value: string) {
  return parseISO(value.length === 10 ? `${value}T00:00:00` : value);
}

function statusColor(status: TaskStatus) {
  if (status === "in_motion") return "var(--status-motion)";
  if (status === "blocked" || status === "at_risk") return "var(--status-risk)";
  if (status === "done") return "var(--status-done)";
  return "var(--status-idle)";
}

function pillClass(status: TaskStatus) {
  if (status === "in_motion") return "bg-foreground text-background";
  if (status === "blocked" || status === "at_risk") return "bg-destructive/10 text-destructive";
  if (status === "done") return "bg-muted text-[var(--success)]";
  return "bg-muted text-muted-foreground";
}

function TaskTitle({
  title,
  done,
  singleLine = false,
  onCommit,
  onEnter,
}: {
  title: string;
  done: boolean;
  singleLine?: boolean;
  onCommit: (title: string) => void;
  onEnter: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  if (!editing) {
    return (
      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 rounded-md px-1 py-1 text-left text-[13px] leading-5 text-foreground hoverable:hover:bg-accent",
          singleLine ? "truncate whitespace-nowrap" : "whitespace-normal break-words",
          done && "text-muted-foreground line-through",
        )}
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
      >
        {title}
      </button>
    );
  }

  return (
    <textarea
      autoFocus
      rows={singleLine ? 1 : Math.max(1, Math.ceil(draft.length / 42))}
      aria-label="Task name"
      className={cn(
        "min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-[13px] leading-5 outline-none focus-visible:rounded-md focus-visible:bg-accent",
        singleLine && "h-8 truncate whitespace-nowrap",
      )}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
        const next = draft.trim();
        if (next && next !== title) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        event.currentTarget.blur();
        onEnter();
      }}
    />
  );
}

function TaskDateAnchor({ pane, children }: { pane: number; children: (slot: HTMLElement | null) => ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return (
    <div className="group border-b border-border">
      {children(slot)}
      <div ref={setSlot} className="sticky left-0 z-10 bg-card px-2 empty:p-0 [&:not(:empty)]:pb-2" style={{ width: pane }} />
    </div>
  );
}

function StatusPill({ status, onChange }: { status: TaskStatus; onChange: (status: TaskStatus) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const options: TaskStatus[] = status === "at_risk" ? ["at_risk", ...TASK_STATUSES] : [...TASK_STATUSES];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="shrink-0">
      <button
        type="button"
        aria-label="Status"
        aria-expanded={open}
        className={cn("press shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", pillClass(status))}
        onClick={() => setOpen((current) => !current)}
      >
        {TASK_STATUS_LABEL[status]}
      </button>
      {open ? (
        <div className="mt-1 flex min-w-36 flex-col rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-pop">
          {options.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-lg px-2 py-1.5 text-left text-xs hoverable:hover:bg-accent"
              onClick={() => {
                setOpen(false);
                if (item !== status) onChange(item);
              }}
            >
              <span className={cn("rounded-full px-2 py-0.5", pillClass(item))}>{TASK_STATUS_LABEL[item]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function useWideLayout(enabled: boolean) {
  return useSyncExternalStore(
    (onChange) => {
      if (!enabled) return () => {};
      const media = window.matchMedia("(min-width: 1024px)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => enabled && window.matchMedia("(min-width: 1024px)").matches,
    () => enabled,
  );
}

export function DealGantt({
  layout = "page",
  deal,
  workstreams,
  tasks,
  onAddWorkstream,
  onRenameWorkstream,
  onDeleteWorkstream,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onRestoreTask,
  onApplyTemplate,
}: {
  layout?: "drawer" | "page";
  deal: Deal;
  workstreams: DealWorkstream[];
  tasks: DealTask[];
  onAddWorkstream: (name: string) => Promise<boolean>;
  onRenameWorkstream: (id: string, name: string) => Promise<boolean>;
  onDeleteWorkstream: (id: string) => Promise<boolean>;
  onAddTask: (workstreamId: string, title: string) => Promise<boolean>;
  onUpdateTask: (id: string, patch: Partial<DealTask>) => Promise<boolean>;
  onDeleteTask: (id: string) => Promise<boolean>;
  onRestoreTask: (task: DealTask) => Promise<boolean>;
  onApplyTemplate: () => Promise<boolean>;
}) {
  const wide = useWideLayout(layout === "page");
  const [draftTask, setDraftTask] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<DealTask | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pane, setPane] = useState(720);
  const runId = useRef(0);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(PANE_KEY));
    if (stored >= PANE_MIN && stored <= PANE_MAX) setPane(stored);
  }, []);

  const run = async (action: () => Promise<boolean>) => {
    const id = ++runId.current;
    setStatus("saving");
    const ok = await action();
    if (runId.current === id) setStatus(ok ? "saved" : "error");
    return ok;
  };

  const range = useMemo(() => {
    const dates: Date[] = [startOfWeek(new Date(), { weekStartsOn: 1 })];
    for (const task of tasks) {
      if (task.start_date) dates.push(parseDay(task.start_date));
      if (task.end_date) dates.push(parseDay(task.end_date));
    }
    for (const value of [deal.target_completion_date, deal.exclusivity_end_date, deal.exclusivity_extension_date]) {
      if (value) dates.push(parseDay(value));
    }
    const min = startOfWeek(new Date(Math.min(...dates.map((date) => date.getTime()))), { weekStartsOn: 1 });
    const maxRaw = new Date(Math.max(...dates.map((date) => date.getTime())));
    const max = addDays(startOfWeek(maxRaw, { weekStartsOn: 1 }), 14);
    const weeks: Date[] = [];
    for (let cursor = min; cursor <= max; cursor = addDays(cursor, 7)) weeks.push(cursor);
    return { start: min, weeks };
  }, [deal.exclusivity_end_date, deal.exclusivity_extension_date, deal.target_completion_date, tasks]);

  const width = Math.max(range.weeks.length * WEEK, 480);
  const offset = (value: string | null) => {
    if (!value) return null;
    return (differenceInCalendarDays(parseDay(value), range.start) / 7) * WEEK;
  };

  const resizePane = (event: ReactPointerEvent) => {
    event.preventDefault();
    const origin = event.clientX;
    const start = pane;
    const move = (ev: PointerEvent) => {
      setPane(Math.min(PANE_MAX, Math.max(PANE_MIN, start + ev.clientX - origin)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPane((current) => {
        window.localStorage.setItem(PANE_KEY, String(current));
        return current;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragBar = (task: DealTask, mode: "move" | "start" | "end", event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const origin = event.clientX;
    const start0 = task.start_date;
    const end0 = task.end_date;
    let next = { start_date: start0, end_date: end0 };
    const move = (ev: PointerEvent) => {
      const days = Math.round((ev.clientX - origin) / DAY);
      next = dragTaskDates(start0, end0, mode, days);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (next.start_date !== start0 || next.end_date !== end0) void run(() => onUpdateTask(task.id, next));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const focusAdd = (workstreamId: string) => {
    document.querySelector<HTMLInputElement>(`[data-add-task="${workstreamId}"]`)?.focus();
  };

  return (
    <section className="min-w-0 max-w-full rounded-2xl bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em]">Next steps</h3>
          <p className="text-xs text-muted-foreground">
            {deal.target_completion_date ? `Target ${format(parseDay(deal.target_completion_date), "d MMM yyyy")}` : "Add a target date in the deal fields."}
            {status === "saving" && " · Saving…"}
            {status === "saved" && " · Saved"}
            {status === "error" && " · Couldn't save"}
          </p>
        </div>
        <button
          type="button"
          className="press inline-flex h-8 items-center gap-1 rounded-full bg-foreground px-3 text-xs font-medium text-background"
          onClick={() => void run(() => onAddWorkstream("New workstream"))}
        >
          <Plus className="size-3.5" />
          Add workstream
        </button>
      </header>

      {undo && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary px-4 py-2 text-sm">
          <span>Deleted “{undo.title}”.</span>
          <button
            type="button"
            className="press text-xs font-medium underline"
            onClick={() => {
              const task = undo;
              setUndo(null);
              void run(() => onRestoreTask(task));
            }}
          >
            Undo
          </button>
        </div>
      )}

      {workstreams.length === 0 ? (
        <div className="px-4 py-8">
          <p className="max-w-xl text-sm text-muted-foreground">
            Workstreams are the rows of the plan: documents, financing, diligence, and the people side. Start from the standard template, modelled on a live next-steps slide, or start with one blank row and name it yourself.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="press h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background" onClick={() => void run(onApplyTemplate)}>
              Start from standard template
            </button>
            <button type="button" className="press h-9 rounded-full border border-border px-4 text-sm" onClick={() => void run(() => onAddWorkstream("Workstream"))}>
              Start blank
            </button>
          </div>
        </div>
      ) : wide ? (
        <div className="sleek-scroll max-w-full overflow-x-auto">
          <div style={{ minWidth: pane + width }}>
            <div className="flex border-b border-border text-[11px] text-muted-foreground">
              <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card px-3 py-2" style={{ width: pane }}>Task</div>
              <div className="flex" style={{ width }}>
                {range.weeks.map((week) => (
                  <div key={week.toISOString()} className="shrink-0 border-r border-border px-1 py-2" style={{ width: WEEK }}>
                    {format(week, "d MMM")}
                  </div>
                ))}
              </div>
            </div>
            {workstreams.map((stream) => {
              const rows = tasks.filter((task) => task.workstream_id === stream.id).sort((a, b) => a.sort_order - b.sort_order);
              return (
                <div key={stream.id}>
                  <div className="flex border-b border-border bg-secondary">
                    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-secondary px-3 py-1.5" style={{ width: pane }}>
                      <input
                        defaultValue={stream.name}
                        aria-label="Workstream name"
                        className="h-8 min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
                        onBlur={(event) => {
                          const name = event.target.value.trim();
                          if (name && name !== stream.name) void run(() => onRenameWorkstream(stream.id, name));
                        }}
                      />
                      <button type="button" className="press text-muted-foreground" aria-label={`Delete ${stream.name}`} onClick={() => void run(() => onDeleteWorkstream(stream.id))}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div style={{ width }} />
                  </div>
                  {rows.map((task) => {
                    const start = offset(task.start_date || task.end_date);
                    const end = offset(task.end_date || task.start_date);
                    const left = start == null ? 8 : Math.max(0, Math.min(start, end ?? start));
                    const barWidth = start == null || end == null ? 28 : Math.max(18, Math.abs(end - start) + 12);
                    return (
                      <TaskDateAnchor key={task.id} pane={pane}>
                        {(slot) => (
                      <div className="flex items-stretch">
                        <div className="relative sticky left-0 z-10 flex shrink-0 flex-nowrap items-center gap-1.5 border-r border-border bg-card px-2 py-1" style={{ width: pane }}>
                          <input
                            type="checkbox"
                            className="size-3.5 shrink-0 accent-foreground"
                            checked={task.status === "done"}
                            aria-label={`Done: ${task.title}`}
                            onChange={(event) => void run(() => onUpdateTask(task.id, { status: event.target.checked ? "done" : "not_started" }))}
                          />
                          <TaskTitle
                            title={task.title}
                            done={task.status === "done"}
                            singleLine
                            onCommit={(title) => void run(() => onUpdateTask(task.id, { title }))}
                            onEnter={() => focusAdd(stream.id)}
                          />
                          <TaskAssignee owner={task.owner} onAssign={(owner) => void run(() => onUpdateTask(task.id, { owner }))} />
                          <TaskDates
                            start={task.start_date}
                            end={task.end_date}
                            slot={slot}
                            onChange={(patch) => void run(() => onUpdateTask(task.id, patch))}
                          />
                          <StatusPill status={task.status} onChange={(next) => void run(() => onUpdateTask(task.id, { status: next }))} />
                          <button
                            type="button"
                            className={cn(
                              "press grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 hoverable:hover:bg-accent hoverable:hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100",
                              task.is_milestone && "text-foreground",
                            )}
                            aria-label={task.is_milestone ? "Milestone" : "Mark as milestone"}
                            aria-pressed={task.is_milestone}
                            onClick={() => void run(() => onUpdateTask(task.id, { is_milestone: !task.is_milestone }))}
                          >
                            <Square className={cn("size-3 rotate-45", task.is_milestone && "fill-current")} />
                          </button>
                          <button
                            type="button"
                            className="press grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 hoverable:hover:bg-accent hoverable:hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                            aria-label={`Delete ${task.title}`}
                            onClick={async () => {
                              const ok = await run(() => onDeleteTask(task.id));
                              if (ok) setUndo(task);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize task list"
                            className="absolute bottom-0 right-0 top-0 w-1.5 cursor-col-resize hoverable:hover:bg-foreground/15"
                            onPointerDown={resizePane}
                          />
                        </div>
                        <div className="relative min-h-11" style={{ width }}>
                          {(task.start_date || task.end_date) && (
                            task.is_milestone ? (
                              <span
                                className="absolute top-1/2 size-3 -translate-y-1/2 rotate-45 cursor-ew-resize"
                                style={{ left, background: statusColor(task.status) }}
                                onPointerDown={(event) => dragBar(task, "move", event)}
                              />
                            ) : (
                              <span
                                className="absolute top-1/2 h-3 -translate-y-1/2 cursor-grab rounded-full active:cursor-grabbing"
                                style={{ left, width: barWidth, background: statusColor(task.status) }}
                                onPointerDown={(event) => dragBar(task, "move", event)}
                              >
                                <i className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" onPointerDown={(event) => dragBar(task, "start", event)} />
                                <i className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" onPointerDown={(event) => dragBar(task, "end", event)} />
                              </span>
                            )
                          )}
                        </div>
                      </div>
                        )}
                      </TaskDateAnchor>
                    );
                  })}
                  <form
                    className="flex border-b border-border"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const title = (draftTask[stream.id] || "").trim();
                      if (!title) return;
                      void run(() => onAddTask(stream.id, title));
                      setDraftTask((current) => ({ ...current, [stream.id]: "" }));
                    }}
                  >
                    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-card px-3" style={{ width: pane }}>
                      <Plus className="size-3.5 text-muted-foreground" />
                      <input
                        data-add-task={stream.id}
                        value={draftTask[stream.id] || ""}
                        onChange={(event) => setDraftTask((current) => ({ ...current, [stream.id]: event.target.value }))}
                        placeholder="Add task"
                        aria-label={`Add task to ${stream.name}`}
                        className="h-9 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    <div style={{ width }} />
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {workstreams.map((stream) => {
            const rows = tasks.filter((task) => task.workstream_id === stream.id).sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={stream.id} className="border-b border-border">
                <div className="flex items-center gap-2 bg-secondary px-3 py-1.5">
                  <input
                    defaultValue={stream.name}
                    aria-label="Workstream name"
                    className="h-8 min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
                    onBlur={(event) => {
                      const name = event.target.value.trim();
                      if (name && name !== stream.name) void run(() => onRenameWorkstream(stream.id, name));
                    }}
                  />
                  <button type="button" className="press text-muted-foreground" aria-label={`Delete ${stream.name}`} onClick={() => void run(() => onDeleteWorkstream(stream.id))}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {rows.map((task) => (
                  <div key={task.id} className="flex flex-col gap-1 border-t border-border px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5 sm:gap-y-1">
                    <div className="flex min-w-0 items-start gap-1.5 sm:contents">
                      <input
                        type="checkbox"
                        className="mt-1 size-3.5 shrink-0 accent-foreground sm:mt-0"
                        checked={task.status === "done"}
                        aria-label={`Done: ${task.title}`}
                        onChange={(event) => void run(() => onUpdateTask(task.id, { status: event.target.checked ? "done" : "not_started" }))}
                      />
                      <TaskTitle
                        title={task.title}
                        done={task.status === "done"}
                        onCommit={(title) => void run(() => onUpdateTask(task.id, { title }))}
                        onEnter={() => focusAdd(stream.id)}
                      />
                    </div>
                    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1 gap-y-1 pl-5 sm:contents">
                      <TaskAssignee owner={task.owner} showName onAssign={(owner) => void run(() => onUpdateTask(task.id, { owner }))} />
                      <TaskDates
                        start={task.start_date}
                        end={task.end_date}
                        onChange={(patch) => void run(() => onUpdateTask(task.id, patch))}
                      />
                      <StatusPill status={task.status} onChange={(next) => void run(() => onUpdateTask(task.id, { status: next }))} />
                      <button
                        type="button"
                        className={cn("press grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent hoverable:hover:text-foreground", task.is_milestone && "text-foreground")}
                        aria-label={task.is_milestone ? "Milestone" : "Mark as milestone"}
                        aria-pressed={task.is_milestone}
                        onClick={() => void run(() => onUpdateTask(task.id, { is_milestone: !task.is_milestone }))}
                      >
                        <Square className={cn("size-3 rotate-45", task.is_milestone && "fill-current")} />
                      </button>
                      <button
                        type="button"
                        className="press grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent hoverable:hover:text-foreground"
                        aria-label={`Delete ${task.title}`}
                        onClick={async () => {
                          const ok = await run(() => onDeleteTask(task.id));
                          if (ok) setUndo(task);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <form
                  className="flex items-center gap-2 border-t border-border px-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const title = (draftTask[stream.id] || "").trim();
                    if (!title) return;
                    void run(() => onAddTask(stream.id, title));
                    setDraftTask((current) => ({ ...current, [stream.id]: "" }));
                  }}
                >
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    data-add-task={stream.id}
                    value={draftTask[stream.id] || ""}
                    onChange={(event) => setDraftTask((current) => ({ ...current, [stream.id]: event.target.value }))}
                    placeholder="Add task"
                    aria-label={`Add task to ${stream.name}`}
                    className="h-9 w-full min-w-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </form>
              </div>
            );
          })}
          <div className="border-t border-border">
            <p className="px-3 py-2 text-[11px] text-muted-foreground">Timeline · scroll sideways</p>
            <div className="max-w-full overflow-x-auto pb-2 [scrollbar-width:thin]">
              <div style={{ width: 148 + width }}>
                <div className="flex border-b border-border text-[11px] text-muted-foreground">
                  <div className="sticky left-0 z-10 w-[148px] shrink-0 border-r border-border bg-card px-3 py-2">Task</div>
                  <div className="flex" style={{ width }}>
                    {range.weeks.map((week) => (
                      <div key={week.toISOString()} className="shrink-0 border-r border-border px-1 py-2" style={{ width: WEEK }}>
                        {format(week, "d MMM")}
                      </div>
                    ))}
                  </div>
                </div>
                {workstreams.map((stream) => {
                  const rows = tasks.filter((task) => task.workstream_id === stream.id).sort((a, b) => a.sort_order - b.sort_order);
                  return (
                    <div key={stream.id}>
                      <div className="flex border-b border-border bg-secondary">
                        <div className="sticky left-0 z-10 w-[148px] shrink-0 truncate border-r border-border bg-secondary px-3 py-1.5 text-[13px] font-semibold">{stream.name}</div>
                        <div style={{ width }} />
                      </div>
                      {rows.map((task) => {
                        const start = offset(task.start_date || task.end_date);
                        const end = offset(task.end_date || task.start_date);
                        const left = start == null ? 8 : Math.max(0, Math.min(start, end ?? start));
                        const barWidth = start == null || end == null ? 28 : Math.max(18, Math.abs(end - start) + 12);
                        return (
                          <div key={task.id} className="flex items-stretch border-b border-border">
                            <div className="sticky left-0 z-10 flex w-[148px] shrink-0 items-center gap-1 border-r border-border bg-card px-1.5 py-1 text-[12px]">
                              <TaskAssignee
                                owner={task.owner}
                                variant="avatar"
                                onAssign={(owner) => void run(() => onUpdateTask(task.id, { owner }))}
                              />
                              <span className="min-w-0 flex-1 truncate" title={task.title}>{task.title}</span>
                            </div>
                            <div className="relative min-h-9" style={{ width }}>
                              {(task.start_date || task.end_date) && (
                                task.is_milestone ? (
                                  <span className="absolute top-1/2 size-3 -translate-y-1/2 rotate-45" style={{ left, background: statusColor(task.status) }} />
                                ) : (
                                  <span className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full" style={{ left, width: barWidth, background: statusColor(task.status) }} />
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
