import { parseFinancial } from "@/lib/financials";

const PREFIX: Record<string, string> = {
  SGD: "S$",
  USD: "US$",
  HKD: "HK$",
  MYR: "RM",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  VND: "VND",
  IDR: "IDR",
  THB: "THB",
  CNY: "RMB",
  PHP: "PHP",
  JPY: "JPY",
  KRW: "KRW",
  INR: "INR",
};

export const CURRENCY_OPTIONS = ["SGD", "USD", "HKD", "MYR", "EUR", "GBP", "AUD", "VND", "IDR", "THB", "CNY", "PHP", "JPY", "KRW", "INR"] as const;

/** Millions figure plus currency, in the text form the financial parser already understands. */
export function amountToText(amount: string, currency: string | null) {
  const trimmed = amount.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const prefix = currency ? `${PREFIX[currency] ?? currency} ` : "";
  const suffix = /[kmb]$/i.test(trimmed) ? "" : "M";
  return `${prefix}${trimmed}${suffix}`;
}

export function amountInputValue(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) return "";
  return String(amount);
}

export function marginPercent(sales: number | null | undefined, ebitda: number | null | undefined) {
  if (sales == null || ebitda == null || sales === 0) return null;
  return (ebitda / sales) * 100;
}

export function valuationMultiple(enterpriseValue: string | null | undefined, ebitda: number | null | undefined) {
  const parsed = parseFinancial(enterpriseValue);
  if (parsed.amount == null || ebitda == null || ebitda === 0) return null;
  return parsed.amount / ebitda;
}

export function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function formatMultiple(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}x`;
}
