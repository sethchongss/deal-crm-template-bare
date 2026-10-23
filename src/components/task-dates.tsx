"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  applyTaskDatePatch,
  formatTaskDay,
  isDateChoiceAllowed,
  monthGrid,
  parseTaskDay,
  shiftMonth,
  taskDateError,
  type TaskDatePatch,
} from "@/lib/task-dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function MonthCalendar({
  label,
  value,
  year,
  month,
  onMonth,
  onPick,
  onClear,
  allowed,
  hint,
}: {
  label: string;
  value: string | null;
  year: number;
  month: number;
  onMonth: (delta: number) => void;
  onPick: (iso: string) => void;
  onClear: () => void;
  allowed: (iso: string) => boolean;
  hint?: string | null;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const title = format(new Date(year, month - 1, 1), "MMMM yyyy");
  return (
    <div
      data-task-dates
      role="dialog"
      aria-label={label}
      className="mt-1 w-full max-w-[17.5rem] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-pop"
    >
      <div className="flex items-center justify-between gap-1">
        <button type="button" className="press grid size-8 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent hoverable:hover:text-foreground" aria-label="Previous month" onClick={() => onMonth(-1)}>
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-xs font-medium">{title}</p>
        <button type="button" className="press grid size-8 place-items-center rounded-md text-muted-foreground hoverable:hover:bg-accent hoverable:hover:text-foreground" aria-label="Next month" onClick={() => onMonth(1)}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <span key={day} className="grid h-6 place-items-center">{day}</span>
        ))}
      </div>
      {monthGrid(year, month).map((week) => (
        <div key={week[0].iso} className="grid grid-cols-7">
          {week.map((day) => {
            const ok = allowed(day.iso);
            const selected = day.iso === value;
            return (
              <button
                key={day.iso}
                type="button"
                disabled={!ok}
                aria-label={format(parseTaskDay(day.iso), "d MMMM yyyy")}
                aria-pressed={selected}
                className={cn(
                  "grid h-8 place-items-center rounded-md text-xs tabular-nums",
                  selected && "bg-foreground text-background",
                  !selected && ok && day.inMonth && "text-foreground hoverable:hover:bg-accent",
                  !selected && ok && !day.inMonth && "text-muted-foreground hoverable:hover:bg-accent",
                  !selected && !ok && "cursor-not-allowed text-muted-foreground/35",
                  !selected && day.iso === today && "ring-1 ring-inset ring-foreground/25",
                )}
                onClick={() => onPick(day.iso)}
              >
                {format(parseTaskDay(day.iso), "d")}
              </button>
            );
          })}
        </div>
      ))}
      {hint ? <p className="px-1 pt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
      <button
        type="button"
        className="press mt-1 h-8 w-full rounded-md text-xs text-muted-foreground hoverable:hover:bg-accent hoverable:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!value}
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}

function monthFrom(value: string | null) {
  const date = value ? parseTaskDay(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function DateButton({
  label,
  value,
  pressed,
  onClick,
}: {
  label: "Start" | "End";
  value: string | null;
  pressed: boolean;
  onClick: () => void;
}) {
  const shown = formatTaskDay(value);
  return (
    <button
      type="button"
      aria-label={shown ? `${label} date, ${shown}` : `${label} date`}
      aria-expanded={pressed}
      aria-haspopup="dialog"
      className={cn(
        "press inline-flex h-8 shrink-0 items-center rounded-md px-1.5 text-xs tabular-nums hoverable:hover:bg-accent",
        shown ? "text-foreground" : "text-muted-foreground",
        pressed && "bg-accent text-foreground",
      )}
      onClick={onClick}
    >
      {shown || label}
    </button>
  );
}

export function TaskDates({
  start,
  end,
  slot = null,
  onChange,
}: {
  start: string | null;
  end: string | null;
  slot?: HTMLElement | null;
  onChange: (patch: TaskDatePatch) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<"start" | "end" | null>(null);
  const [cursor, setCursor] = useState(() => monthFrom(null));
  const [rejected, setRejected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (slot?.contains(target)) return;
      setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    const dialog = slot?.querySelector("[role='dialog']") ?? rootRef.current?.querySelector("[role='dialog']");
    dialog?.scrollIntoView({ block: "nearest" });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, slot]);

  const show = (field: "start" | "end") => {
    setRejected(null);
    if (open === field) {
      setOpen(null);
      return;
    }
    const seed = (field === "start" ? start : end) || (field === "start" ? end : start);
    setCursor(monthFrom(seed));
    setOpen(field);
  };

  const commit = (patch: TaskDatePatch) => {
    const result = applyTaskDatePatch({ start, end }, patch);
    if (!result.ok) {
      setRejected(result.error);
      return;
    }
    setRejected(null);
    setOpen(null);
    const startChanged = patch.start_date !== undefined && patch.start_date !== start;
    const endChanged = patch.end_date !== undefined && patch.end_date !== end;
    if (startChanged || endChanged) onChange(patch);
  };

  const error = rejected || taskDateError(start, end);
  const value = open === "start" ? start : open === "end" ? end : null;
  const repair = Boolean(start && end && end < start);
  const blocksEarlier = open === "end" && Boolean(start) && !repair;
  const blocksLater = open === "start" && Boolean(end) && !repair;
  const calendar: ReactNode = open ? (
    <MonthCalendar
      label={open === "start" ? "Choose start date" : "Choose end date"}
      value={value}
      year={cursor.year}
      month={cursor.month}
      onMonth={(delta) => setCursor((current) => shiftMonth(current.year, current.month, delta))}
      onPick={(iso) => commit(open === "start" ? { start_date: iso } : { end_date: iso })}
      onClear={() => commit(open === "start" ? { start_date: null } : { end_date: null })}
      allowed={(iso) => isDateChoiceAllowed(open, iso, start, end)}
      hint={blocksEarlier ? "End date must be on or after the start date." : blocksLater ? "Start date must be on or before the end date." : null}
    />
  ) : null;

  return (
    <div ref={rootRef} data-task-dates className="flex min-w-0 max-w-full flex-col">
      <div className="flex items-center gap-0.5">
        <DateButton label="Start" value={start} pressed={open === "start"} onClick={() => show("start")} />
        <span className="px-0.5 text-xs text-muted-foreground" aria-hidden="true">
          –
        </span>
        <DateButton label="End" value={end} pressed={open === "end"} onClick={() => show("end")} />
      </div>
      {error ? (
        <p role="alert" className="px-1 pt-0.5 text-[11px] leading-4 text-destructive">
          {error}
        </p>
      ) : null}
      {calendar && slot ? createPortal(calendar, slot) : calendar}
    </div>
  );
}

export function DateField({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  label: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => monthFrom(value));

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

  const shown = value ? format(parseTaskDay(value), "d MMM yyyy") : null;

  return (
    <div ref={rootRef} data-task-dates>
      <button
        type="button"
        aria-label={shown ? `${label}, ${shown}` : label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex h-9 w-full items-center rounded-lg border border-border bg-background px-2.5 text-left text-sm outline-none focus-visible:shadow-focus",
          shown ? "text-foreground" : "text-muted-foreground",
        )}
        onClick={() => {
          setCursor(monthFrom(value));
          setOpen((current) => !current);
        }}
      >
        {shown || "Add date"}
      </button>
      {open ? (
        <MonthCalendar
          label={label}
          value={value}
          year={cursor.year}
          month={cursor.month}
          onMonth={(delta) => setCursor((current) => shiftMonth(current.year, current.month, delta))}
          onPick={(iso) => {
            setOpen(false);
            if (iso !== value) onChange(iso);
          }}
          onClear={() => {
            setOpen(false);
            if (value) onChange(null);
          }}
          allowed={() => true}
        />
      ) : null}
    </div>
  );
}
