import { formatMillions, parseFinancial } from "@/lib/financials";

const SYMBOL: Record<string, string> = {
  SGD: "S$",
  USD: "US$",
  HKD: "HK$",
  NZD: "NZ$",
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
  TWD: "TWD",
  CAD: "CAD",
  CHF: "CHF",
};

export type CardValuationInput = {
  enterprise_value?: string | null;
  fin_currency?: string | null;
  ebitda_amount?: number | string | null;
  sales_amount?: number | string | null;
  /** Used when the stored EBITDA amount is empty, so approximate or newer currency text still shows. */
  latest_ebitda?: string | null;
  latest_sales?: string | null;
};

export type CardValuationLine = {
  /** Compact card line, or null when neither EV nor EBITDA can be shown. */
  line: string | null;
  /** Fuller figures for a tooltip. Null when the line is omitted. */
  title: string | null;
};

function currencyCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  if (!code || !/^[A-Z]{3}$/.test(code)) return null;
  return code;
}

/** Tight symbols (`S$12.0m`) and a space before letter codes (`RM 12.0m`). */
function moneyPrefix(currency: string | null) {
  if (!currency) return "";
  const mark = SYMBOL[currency] ?? currency;
  return /[$€£]$/.test(mark) ? mark : `${mark} `;
}

function compactMoney(amount: number, currency: string | null) {
  return `${moneyPrefix(currency)}${formatMillions(amount, null)}`;
}

function fullMoney(amount: number, currency: string | null) {
  const body = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${moneyPrefix(currency)}${body}m`;
}

function finiteAmount(value: number | string | null | undefined) {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/** Stored millions win. Otherwise parse the original display text. */
function resolvedAmount(numeric: number | string | null | undefined, text: string | null | undefined) {
  const direct = finiteAmount(numeric);
  if (direct != null) return { amount: direct, currency: null as string | null };
  const parsed = parseFinancial(text);
  if (parsed.amount == null) return { amount: null, currency: null as string | null };
  return { amount: parsed.amount, currency: parsed.currency };
}

function oneDecimal(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  const text = rounded.toFixed(1);
  return text === "-0.0" ? "0.0" : text;
}

function parsedEnterpriseValue(value: string | null | undefined) {
  const parsed = parseFinancial(value);
  if (parsed.amount == null || !Number.isFinite(parsed.amount)) return null;
  return parsed;
}

/**
 * Financials one-liner for a deal card.
 * Includes only the pieces that exist: enterprise value, EBITDA (including
 * zero and negative), the implied EV/EBITDA multiple when EBITDA is positive,
 * and an EV/sales multiple when both EV and positive sales exist.
 * Sales alone never starts a line, and a sales multiple is omitted without EV.
 */
export function cardValuation(input: CardValuationInput): CardValuationLine {
  const parsed = parsedEnterpriseValue(input.enterprise_value);
  const ebitdaParsed = resolvedAmount(input.ebitda_amount, input.latest_ebitda);
  const ebitda = ebitdaParsed.amount;
  if (!parsed && ebitda == null) return { line: null, title: null };

  const dealCurrency = currencyCode(input.fin_currency);
  const ebitdaCurrency = ebitdaParsed.currency ?? dealCurrency;
  const parts: string[] = [];
  const titleParts: string[] = [];

  const ev = parsed?.amount ?? null;
  if (parsed && ev != null) {
    const evCurrency = parsed.currency ?? dealCurrency;
    parts.push(`EV ${compactMoney(ev, evCurrency)}`);
    titleParts.push(`Expected valuation ${fullMoney(ev, evCurrency)}`);
  }

  if (ebitda != null) {
    parts.push(`EBITDA ${compactMoney(ebitda, ebitdaCurrency)}`);
    titleParts.push(`EBITDA ${fullMoney(ebitda, ebitdaCurrency)}`);
  }

  if (ev != null && ebitda != null && ebitda > 0) {
    const multiple = `${oneDecimal(ev / ebitda)}×`;
    parts.push(multiple);
    titleParts.push(`${multiple} EBITDA`);
  }

  const salesParsed = resolvedAmount(input.sales_amount, input.latest_sales);
  const sales = salesParsed.amount;
  const salesCurrency = salesParsed.currency ?? dealCurrency;
  if (ev != null && sales != null && sales > 0) {
    const multiple = `${oneDecimal(ev / sales)}×`;
    parts.push(`${multiple} sales`);
    titleParts.push(`${multiple} sales (${fullMoney(sales, salesCurrency)})`);
  }

  return { line: parts.join(" · "), title: titleParts.join(" · ") };
}
