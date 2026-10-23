import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deriveDealFinancials, parseFinancial } from "./financials.ts";

const profile = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/sample-profile.json"), "utf8"),
) as {
  latest_sales: [string | null, number][];
  latest_ebitda: [string | null, number][];
  net_debt_cash: [string | null, number][];
};

const expected: Record<string, { amount: number | null; currency: string | null; assumed: boolean }> = {
  "": { amount: null, currency: null, assumed: false },
  "-": { amount: null, currency: null, assumed: false },
  "40%": { amount: null, currency: null, assumed: false },
  "0": { amount: 0, currency: null, assumed: true },
  "5M": { amount: 5, currency: null, assumed: true },
  "45M": { amount: 45, currency: null, assumed: true },
  "18.5M": { amount: 18.5, currency: null, assumed: true },
  "22.9M": { amount: 22.9, currency: null, assumed: true },
  "4.3M": { amount: 4.3, currency: null, assumed: true },
  "39.6M": { amount: 39.6, currency: null, assumed: true },
  "11.7M": { amount: 11.7, currency: null, assumed: true },
  "2.59M": { amount: 2.59, currency: null, assumed: true },
  "5.1M": { amount: 5.1, currency: null, assumed: true },
  "8.4M": { amount: 8.4, currency: null, assumed: true },
  "3.00M": { amount: 3, currency: null, assumed: true },
  "500K": { amount: 0.5, currency: null, assumed: true },
  "S$2.00M": { amount: 2, currency: "SGD", assumed: false },
  "S$48.60M": { amount: 48.6, currency: "SGD", assumed: false },
  "S$5.2M": { amount: 5.2, currency: "SGD", assumed: false },
  "S$0.7M": { amount: 0.7, currency: "SGD", assumed: false },
  "S$20.91M": { amount: 20.91, currency: "SGD", assumed: false },
  "S$3.30M": { amount: 3.3, currency: "SGD", assumed: false },
  "S$2.7M": { amount: 2.7, currency: "SGD", assumed: false },
  "S$4.8M": { amount: 4.8, currency: "SGD", assumed: false },
  "S$30.00M": { amount: 30, currency: "SGD", assumed: false },
  "S$37.16M": { amount: 37.16, currency: "SGD", assumed: false },
  "S$8.56M": { amount: 8.56, currency: "SGD", assumed: false },
  "S$17.60M": { amount: 17.6, currency: "SGD", assumed: false },
  "S$10.2M": { amount: 10.2, currency: "SGD", assumed: false },
  "S$1.79M": { amount: 1.79, currency: "SGD", assumed: false },
  "S$35.3M": { amount: 35.3, currency: "SGD", assumed: false },
  "S$77M": { amount: 77, currency: "SGD", assumed: false },
  "S$1.86M": { amount: 1.86, currency: "SGD", assumed: false },
  "S$7M": { amount: 7, currency: "SGD", assumed: false },
  "S$2.6M": { amount: 2.6, currency: "SGD", assumed: false },
  "S$9.8M": { amount: 9.8, currency: "SGD", assumed: false },
  "S$3.18M": { amount: 3.18, currency: "SGD", assumed: false },
  "S$31.1M": { amount: 31.1, currency: "SGD", assumed: false },
  "S$10.10M": { amount: 10.1, currency: "SGD", assumed: false },
  "S$19M": { amount: 19, currency: "SGD", assumed: false },
  "S$1.90M": { amount: 1.9, currency: "SGD", assumed: false },
  "S$20.20M": { amount: 20.2, currency: "SGD", assumed: false },
  "S$35.00M": { amount: 35, currency: "SGD", assumed: false },
  "S$9.47M": { amount: 9.47, currency: "SGD", assumed: false },
  "S$15M": { amount: 15, currency: "SGD", assumed: false },
  "S$187.70M": { amount: 187.7, currency: "SGD", assumed: false },
  "S$74.40M": { amount: 74.4, currency: "SGD", assumed: false },
  "S$6.5M": { amount: 6.5, currency: "SGD", assumed: false },
  "S$14.86M": { amount: 14.86, currency: "SGD", assumed: false },
  "S$4.4M": { amount: 4.4, currency: "SGD", assumed: false },
  "S$7.00M": { amount: 7, currency: "SGD", assumed: false },
  "S$13.20M": { amount: 13.2, currency: "SGD", assumed: false },
  "S$1.3M": { amount: 1.3, currency: "SGD", assumed: false },
  "S$0.2M": { amount: 0.2, currency: "SGD", assumed: false },
  "S$6.73M": { amount: 6.73, currency: "SGD", assumed: false },
  "S$1.70M": { amount: 1.7, currency: "SGD", assumed: false },
  "S$1.27M": { amount: 1.27, currency: "SGD", assumed: false },
  "S$1.2M": { amount: 1.2, currency: "SGD", assumed: false },
  "S$7.40M": { amount: 7.4, currency: "SGD", assumed: false },
  "S$0.66M": { amount: 0.66, currency: "SGD", assumed: false },
  "S$2.18M": { amount: 2.18, currency: "SGD", assumed: false },
  "S$28M": { amount: 28, currency: "SGD", assumed: false },
  "S$4M": { amount: 4, currency: "SGD", assumed: false },
  "S$1.1M": { amount: 1.1, currency: "SGD", assumed: false },
  "S$3.5M": { amount: 3.5, currency: "SGD", assumed: false },
  "S$2M": { amount: 2, currency: "SGD", assumed: false },
  "S$1.4M": { amount: 1.4, currency: "SGD", assumed: false },
  "S$6.6M": { amount: 6.6, currency: "SGD", assumed: false },
  "S$4.48M": { amount: 4.48, currency: "SGD", assumed: false },
  "S$3M": { amount: 3, currency: "SGD", assumed: false },
  "S$0.07M": { amount: 0.07, currency: "SGD", assumed: false },
  "S$2.40M": { amount: 2.4, currency: "SGD", assumed: false },
  "S$6.7M": { amount: 6.7, currency: "SGD", assumed: false },
  "S$22.70M": { amount: 22.7, currency: "SGD", assumed: false },
  "S$1.84M": { amount: 1.84, currency: "SGD", assumed: false },
  "S$0.09M": { amount: 0.09, currency: "SGD", assumed: false },
  "S$-1.12M": { amount: -1.12, currency: "SGD", assumed: false },
  "S$54M": { amount: 54, currency: "SGD", assumed: false },
  "S$7.2M": { amount: 7.2, currency: "SGD", assumed: false },
  "(S$11M)": { amount: -11, currency: "SGD", assumed: false },
  "S$-1.80M": { amount: -1.8, currency: "SGD", assumed: false },
  "S$-4.95M": { amount: -4.95, currency: "SGD", assumed: false },
  "US$12.5M": { amount: 12.5, currency: "USD", assumed: false },
  "US$65.00M": { amount: 65, currency: "USD", assumed: false },
  "US$1.73M": { amount: 1.73, currency: "USD", assumed: false },
  "US$286M": { amount: 286, currency: "USD", assumed: false },
  "US$7.6M": { amount: 7.6, currency: "USD", assumed: false },
  "US$19.2M": { amount: 19.2, currency: "USD", assumed: false },
  "US$214M": { amount: 214, currency: "USD", assumed: false },
  "US$193.60M": { amount: 193.6, currency: "USD", assumed: false },
  "US$13.9M": { amount: 13.9, currency: "USD", assumed: false },
  "US$7.4M": { amount: 7.4, currency: "USD", assumed: false },
  "US$17.2M": { amount: 17.2, currency: "USD", assumed: false },
  "US$3.15M": { amount: 3.15, currency: "USD", assumed: false },
  "US$18.30M": { amount: 18.3, currency: "USD", assumed: false },
  "US$5.7M": { amount: 5.7, currency: "USD", assumed: false },
  "US$2.3M": { amount: 2.3, currency: "USD", assumed: false },
  "US$-9M": { amount: -9, currency: "USD", assumed: false },
  "US$5.10M": { amount: 5.1, currency: "USD", assumed: false },
  "US$5.6M": { amount: 5.6, currency: "USD", assumed: false },
  "US$3.6M": { amount: 3.6, currency: "USD", assumed: false },
  "US$3.8M": { amount: 3.8, currency: "USD", assumed: false },
  "US$7.5M": { amount: 7.5, currency: "USD", assumed: false },
  "US$93M": { amount: 93, currency: "USD", assumed: false },
  "A$8.9M": { amount: 8.9, currency: "AUD", assumed: false },
  "A$1.9M": { amount: 1.9, currency: "AUD", assumed: false },
  "HK$41.50M": { amount: 41.5, currency: "HKD", assumed: false },
  "HK$40.00M": { amount: 40, currency: "HKD", assumed: false },
  "HK$5.30M": { amount: 5.3, currency: "HKD", assumed: false },
  "HK$-17.00M": { amount: -17, currency: "HKD", assumed: false },
  "RM 21.20M": { amount: 21.2, currency: "MYR", assumed: false },
  "RM 5.28M": { amount: 5.28, currency: "MYR", assumed: false },
  "VND 50.00B": { amount: 50000, currency: "VND", assumed: false },
  "VND 20.00B": { amount: 20000, currency: "VND", assumed: false },
};

function valuesOf(rows: [string | null, number][]) {
  return rows.map(([value]) => value).filter((value): value is string => value != null);
}

test("every sample financial string has an expected parse", () => {
  const live = new Set([
    ...valuesOf(profile.latest_sales),
    ...valuesOf(profile.latest_ebitda),
    ...valuesOf(profile.net_debt_cash),
  ]);
  const missing = [...live].filter((value) => !(value in expected));
  assert.deepEqual(missing, []);
});

test("parser matches every live financial value", () => {
  for (const [raw, want] of Object.entries(expected)) {
    assert.deepEqual(parseFinancial(raw), want, raw);
  }
  assert.deepEqual(parseFinancial(null), { amount: null, currency: null, assumed: false });
  assert.deepEqual(parseFinancial("   "), { amount: null, currency: null, assumed: false });
});

test("approximate marks and regional currency codes still become millions", () => {
  assert.deepEqual(parseFinancial("~US$5M"), { amount: 5, currency: "USD", assumed: false });
  assert.deepEqual(parseFinancial("US$~100M"), { amount: 100, currency: "USD", assumed: false });
  assert.deepEqual(parseFinancial("US$ ~ 18M"), { amount: 18, currency: "USD", assumed: false });
  assert.deepEqual(parseFinancial("~S$8M"), { amount: 8, currency: "SGD", assumed: false });
  assert.deepEqual(parseFinancial("~S$0.4M"), { amount: 0.4, currency: "SGD", assumed: false });
  assert.deepEqual(parseFinancial("(S$0.6M)"), { amount: -0.6, currency: "SGD", assumed: false });
  assert.deepEqual(parseFinancial("(US$21.4M)"), { amount: -21.4, currency: "USD", assumed: false });
  assert.deepEqual(parseFinancial("THB805M"), { amount: 805, currency: "THB", assumed: false });
  assert.deepEqual(parseFinancial("~THB16M"), { amount: 16, currency: "THB", assumed: false });
  assert.deepEqual(parseFinancial("THB41.7M"), { amount: 41.7, currency: "THB", assumed: false });
  assert.deepEqual(parseFinancial("RMB146M"), { amount: 146, currency: "CNY", assumed: false });
  assert.deepEqual(parseFinancial("RMB581M"), { amount: 581, currency: "CNY", assumed: false });
  assert.deepEqual(parseFinancial("PHP 12.5M"), { amount: 12.5, currency: "PHP", assumed: false });
  assert.deepEqual(parseFinancial("~5M"), { amount: 5, currency: null, assumed: true });
  assert.deepEqual(parseFinancial("500K"), { amount: 0.5, currency: null, assumed: true });
  assert.deepEqual(parseFinancial("-"), { amount: null, currency: null, assumed: false });
  assert.deepEqual(parseFinancial("~3x EBITDA at entry"), { amount: null, currency: null, assumed: false });
  assert.deepEqual(parseFinancial("Debt-free"), { amount: null, currency: null, assumed: false });
  assert.deepEqual(parseFinancial("RM 21.20M"), { amount: 21.2, currency: "MYR", assumed: false });
  assert.deepEqual(parseFinancial("VND 50.00B"), { amount: 50000, currency: "VND", assumed: false });
});

test("deal currency is shared only when the parsed codes agree", () => {
  const mixed = deriveDealFinancials("S$10M", "US$2M", null);
  assert.equal(mixed.sales_amount, 10);
  assert.equal(mixed.ebitda_amount, 2);
  assert.equal(mixed.fin_currency, null);
  assert.equal(mixed.fin_currency_assumed, false);

  const bare = deriveDealFinancials("S$10M", "5M", null);
  assert.equal(bare.fin_currency, "SGD");
  assert.equal(bare.fin_currency_assumed, true);

  const negative = deriveDealFinancials(null, null, "(S$11M)");
  assert.equal(negative.net_debt_amount, -11);
  assert.equal(negative.fin_currency, "SGD");
});
