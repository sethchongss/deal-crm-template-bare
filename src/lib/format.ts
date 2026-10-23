import { differenceInCalendarDays, differenceInMonths, format, parseISO, startOfDay } from "date-fns";
import { countryFlag } from "@/lib/taxonomy";
import { formatMillions, headlineFinancial, parseFinancial } from "@/lib/financials";

function parseTimestamp(value: string) {
  const text = value.trim();
  if (!text) return null;
  const date = parseISO(text.length === 10 ? `${text}T00:00:00` : text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatDate(value: string | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—";
  const date = parseTimestamp(value);
  if (!date) return "—";
  return format(date, pattern);
}

export function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const date = parseTimestamp(value);
  if (!date) return null;
  const days = differenceInCalendarDays(new Date(), date);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/** When the deal was logged: entry date, or created_at when entry_date is empty or unreadable. */
export function dealLoggedOn(entryDate: string | null | undefined, createdAt: string | null | undefined) {
  const entry = entryDate?.trim();
  if (entry && parseTimestamp(entry)) return entry;
  const created = createdAt?.trim();
  if (created && parseTimestamp(created)) return created;
  return null;
}

/**
 * Compact age since a deal was logged.
 * Today, then days under 14, weeks under 2 months, months under 12, then years.
 * Month and year boundaries follow the calendar day, not the clock time.
 */
export function loggedAge(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  const date = parseTimestamp(value);
  if (!date) return null;
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return "Today";
  if (days < 14) return days === 1 ? "1 day" : `${days} days`;
  const months = differenceInMonths(startOfDay(now), startOfDay(date));
  if (months < 2) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 wk" : `${weeks} wks`;
  }
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  if (remainder === 0) return `${years} yr`;
  return `${years} yr ${remainder} mo`;
}

export function loggedAgeTitle(value: string | null | undefined) {
  const formatted = formatDate(value);
  if (formatted === "—") return null;
  return `Logged ${formatted}`;
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const date = parseISO(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) return `${Math.abs(days)}d past`;
  if (days === 0) return "Today";
  return `${days}d left`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function countryLabel(country: string | null | undefined) {
  if (!country) return null;
  const first = country.split("/")[0]?.trim();
  if (!first) return null;
  const flag = countryFlag(first);
  return flag ? `${flag} ${first}` : first;
}

export function moneyLabel(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  return formatMillions(Number(amount), currency ?? null);
}

export function dealHeadline(sales: string | null | undefined, ebitda: string | null | undefined) {
  return headlineFinancial(sales, ebitda);
}

export function parsedBeside(raw: string | null | undefined) {
  const parsed = parseFinancial(raw);
  if (parsed.amount == null) return null;
  const label = formatMillions(parsed.amount, parsed.currency);
  return parsed.assumed ? `${label} · currency not stated` : label;
}

export { parseFinancial };
