/**
 * Parses free-text deal financials into millions of currency.
 * Mirrors public.parse_financial. The original body is in
 * supabase/migrations/20261003130300_financials.sql; approximate marks and
 * THB / RMB / other codes are added in 20261006120000_deal_proprietary.sql.
 * The original text stays the source of truth when this returns a null amount.
 */

export type ParsedFinancial = {
  amount: number | null;
  currency: string | null;
  /** True when a number was parsed but no currency prefix was present. */
  assumed: boolean;
};

const EMPTY: ParsedFinancial = { amount: null, currency: null, assumed: false };

const CURRENCIES: { pattern: RegExp; code: string }[] = [
  { pattern: /^US\$\s*/i, code: "USD" },
  { pattern: /^HK\$\s*/i, code: "HKD" },
  { pattern: /^NZ\$\s*/i, code: "NZD" },
  { pattern: /^A\$\s*/i, code: "AUD" },
  { pattern: /^S\$\s*/i, code: "SGD" },
  // RMB is a prefix of neither, but RM is a prefix of RMB, so RMB comes first.
  { pattern: /^RMB\s*/i, code: "CNY" },
  { pattern: /^RM\s*/i, code: "MYR" },
  { pattern: /^CNY\s*/i, code: "CNY" },
  { pattern: /^CNH\s*/i, code: "CNY" },
  { pattern: /^THB\s*/i, code: "THB" },
  { pattern: /^VND\s*/i, code: "VND" },
  { pattern: /^IDR\s*/i, code: "IDR" },
  { pattern: /^PHP\s*/i, code: "PHP" },
  { pattern: /^JPY\s*/i, code: "JPY" },
  { pattern: /^KRW\s*/i, code: "KRW" },
  { pattern: /^INR\s*/i, code: "INR" },
  { pattern: /^TWD\s*/i, code: "TWD" },
  { pattern: /^SGD\s*/i, code: "SGD" },
  { pattern: /^USD\s*/i, code: "USD" },
  { pattern: /^HKD\s*/i, code: "HKD" },
  { pattern: /^MYR\s*/i, code: "MYR" },
  { pattern: /^AUD\s*/i, code: "AUD" },
  { pattern: /^EUR\s*/i, code: "EUR" },
  { pattern: /^GBP\s*/i, code: "GBP" },
  { pattern: /^CAD\s*/i, code: "CAD" },
  { pattern: /^CHF\s*/i, code: "CHF" },
  { pattern: /^€\s*/, code: "EUR" },
  { pattern: /^£\s*/, code: "GBP" },
];

/** A leading ~ or "approx" means the figure is approximate. The number still counts. */
function stripApprox(value: string) {
  return value.replace(/^(?:~+|≈+)\s*/, "").replace(/^approx(?:\.|imately)?\s+/i, "").trim();
}

const NUMBER = /^([+-])?\s*(\d+(?:\.\d+)?)\s*([KMB])?$/i;

function round6(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

export function parseFinancial(raw: string | null | undefined): ParsedFinancial {
  if (raw == null) return EMPTY;
  let text = raw.trim();
  if (text === "" || text === "-" || text === "—" || text === "–" || /^n\.?a\.?$/i.test(text)) {
    return EMPTY;
  }
  if (text.includes("%")) return EMPTY;

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1).trim();
  }

  text = stripApprox(text);

  let currency: string | null = null;
  for (const entry of CURRENCIES) {
    const match = text.match(entry.pattern);
    if (match) {
      currency = entry.code;
      text = text.slice(match[0].length).trim();
      break;
    }
  }

  text = stripApprox(text).replace(/,/g, "").trim();
  const match = text.match(NUMBER);
  if (!match) return EMPTY;

  if (match[1] === "-") negative = true;
  let amount = Number(match[2]);
  if (!Number.isFinite(amount)) return EMPTY;

  const scale = match[3]?.toUpperCase();
  if (scale === "K") amount /= 1000;
  else if (scale === "B") amount *= 1000;

  if (negative) amount = -Math.abs(amount);
  return { amount: round6(amount), currency, assumed: currency == null };
}

export type DealFinancialFields = {
  sales_amount: number | null;
  ebitda_amount: number | null;
  net_debt_amount: number | null;
  fin_currency: string | null;
  fin_currency_assumed: boolean;
};

/** Deal-level currency is set only when every parsed amount shares one code. */
export function deriveDealFinancials(
  sales: string | null | undefined,
  ebitda: string | null | undefined,
  netDebt: string | null | undefined,
): DealFinancialFields {
  const parsed = [parseFinancial(sales), parseFinancial(ebitda), parseFinancial(netDebt)];
  const codes = [...new Set(parsed.map((item) => item.currency).filter((code): code is string => !!code))];
  return {
    sales_amount: parsed[0].amount,
    ebitda_amount: parsed[1].amount,
    net_debt_amount: parsed[2].amount,
    fin_currency: codes.length === 1 ? codes[0] : null,
    fin_currency_assumed: parsed.some((item) => item.amount != null && item.currency == null),
  };
}

export function formatMillions(amount: number, currency: string | null): string {
  const abs = Math.abs(amount);
  const digits = abs !== 0 && abs < 10 ? 2 : abs < 100 ? 1 : 0;
  const body = amount.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return currency ? `${currency} ${body}m` : `${body}m`;
}

/** Prefer parsed EBITDA, then parsed sales, then the original text. */
export function headlineFinancial(
  sales: string | null | undefined,
  ebitda: string | null | undefined,
): string | null {
  const ebitdaParsed = parseFinancial(ebitda);
  if (ebitdaParsed.amount != null) {
    return `${formatMillions(ebitdaParsed.amount, ebitdaParsed.currency)} EBITDA`;
  }
  const salesParsed = parseFinancial(sales);
  if (salesParsed.amount != null) {
    return `${formatMillions(salesParsed.amount, salesParsed.currency)} sales`;
  }
  const fallback = [ebitda, sales].find((value) => value && value.trim() && value.trim() !== "-");
  return fallback?.trim() ?? null;
}
