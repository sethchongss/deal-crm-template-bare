import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";

/**
 * Day offsets from the moment the template is applied. `start` and `end` are
 * both offsets from that day (0 = that day), not durations and not offsets
 * from the deal's target or exclusivity date.
 */
export const STANDARD_TEMPLATE: {
  name: string;
  tasks: { title: string; start: number; end: number; milestone?: boolean }[];
}[] = [
  {
    name: "Documents",
    tasks: [
      { title: "Term sheet", start: 0, end: 7, milestone: true },
      { title: "SPA and SHA", start: 7, end: 28 },
      { title: "Signing", start: 28, end: 35, milestone: true },
      { title: "Completion", start: 42, end: 42, milestone: true },
    ],
  },
  {
    name: "Financing",
    tasks: [
      { title: "Lender outreach", start: 0, end: 14 },
      { title: "Credit approval", start: 14, end: 35 },
      { title: "Facility documents", start: 28, end: 42 },
    ],
  },
  {
    name: "Diligence",
    tasks: [
      { title: "Legal diligence", start: 0, end: 21 },
      { title: "Financial diligence", start: 0, end: 21 },
    ],
  },
  {
    name: "Family and company",
    tasks: [
      { title: "Vendor position", start: 0, end: 7, milestone: true },
      { title: "Management handover", start: 14, end: 35 },
    ],
  },
];

/**
 * Calendar day written when the template is applied.
 * Adds `days` to the local calendar date of `now`, then stores the UTC day
 * of that instant (`toISOString`), which is how template rows have always been saved.
 */
export function templateDate(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseTaskDay(value: string) {
  return parseISO(value.length === 10 ? `${value}T00:00:00` : value);
}

export function formatTaskDay(value: string | null) {
  if (!value) return null;
  const date = parseTaskDay(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "d MMM");
}

export function addCalendarDays(value: string, days: number) {
  return format(addDays(parseTaskDay(value), days), "yyyy-MM-dd");
}

export type TaskDatePatch = { start_date?: string | null; end_date?: string | null };

export function taskDateError(start: string | null, end: string | null) {
  if (start && end && end < start) return "End date must be on or after the start date.";
  return null;
}

export function applyTaskDatePatch(
  current: { start: string | null; end: string | null },
  patch: TaskDatePatch,
): { ok: true; start: string | null; end: string | null } | { ok: false; error: string } {
  const start = patch.start_date !== undefined ? patch.start_date : current.start;
  const end = patch.end_date !== undefined ? patch.end_date : current.end;
  const error = taskDateError(start, end);
  if (error) return { ok: false, error };
  return { ok: true, start, end };
}

export function isDateChoiceAllowed(
  field: "start" | "end",
  iso: string,
  start: string | null,
  end: string | null,
) {
  if (start && end && end < start) return true;
  if (field === "end" && start && iso < start) return false;
  if (field === "start" && end && iso > end) return false;
  return true;
}

export function dragTaskDates(
  start: string | null,
  end: string | null,
  mode: "move" | "start" | "end",
  days: number,
): { start_date: string | null; end_date: string | null } {
  const shift = (value: string | null) => (value ? addCalendarDays(value, days) : null);
  if (mode === "move") return { start_date: shift(start), end_date: shift(end) };
  if (mode === "start") {
    let next = shift(start || end);
    if (next && end && next > end) next = end;
    return { start_date: next, end_date: end };
  }
  let next = shift(end || start);
  if (start && next && next < start) next = start;
  return { start_date: start, end_date: next };
}

export type CalendarCell = { iso: string; inMonth: boolean };

export function monthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(year, month - 1, 1);
  const start = startOfWeek(first, { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end }).map((day) => ({
    iso: format(day, "yyyy-MM-dd"),
    inMonth: day.getMonth() === first.getMonth(),
  }));
  const weeks: CalendarCell[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const next = addMonths(new Date(year, month - 1, 1), delta);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}
