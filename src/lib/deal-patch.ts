import { deriveDealFinancials } from "@/lib/financials";
import { normalizeCountries, normalizeSector } from "@/lib/taxonomy";
import type { Deal } from "@/types/database";

function sourceChanged(patch: Partial<Deal>, current: Partial<Deal> | undefined, key: keyof Deal) {
  if (!current || !(key in current)) return true;
  return (patch[key] ?? null) !== (current[key] ?? null);
}

/**
 * When a patch edits sector, country, or a financial text column, it also writes
 * the derived columns from that text. Unchanged source text is left alone, and a
 * patch that only sets a derived column is kept as written.
 * The database trigger agrees: it re-derives only when the source text changes
 * or the derived value is still null.
 */
export function prepareDealPatch(patch: Partial<Deal>, current?: Partial<Deal>): Partial<Deal> {
  const next: Partial<Deal> = { ...patch };
  if ("sector" in patch && sourceChanged(patch, current, "sector")) {
    const mapped = normalizeSector(patch.sector ?? null);
    next.sector_group = mapped.sector_group;
    next.sector_detail = mapped.sector_detail;
  }
  if ("country" in patch && sourceChanged(patch, current, "country")) {
    next.countries = normalizeCountries(patch.country ?? null);
  }
  const financials = ["latest_sales", "latest_ebitda", "net_debt_cash"] as const;
  if (financials.some((key) => key in patch && sourceChanged(patch, current, key))) {
    Object.assign(
      next,
      deriveDealFinancials(
        "latest_sales" in patch ? patch.latest_sales : current?.latest_sales,
        "latest_ebitda" in patch ? patch.latest_ebitda : current?.latest_ebitda,
        "net_debt_cash" in patch ? patch.net_debt_cash : current?.net_debt_cash,
      ),
    );
  }
  return next;
}

export function blankToNull<T extends Record<string, unknown>>(value: T): T {
  const next = { ...value };
  for (const [key, item] of Object.entries(next)) {
    if (item === "") (next as Record<string, unknown>)[key] = null;
  }
  return next;
}
