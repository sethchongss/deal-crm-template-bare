import assert from "node:assert/strict";
import test from "node:test";
import { cardValuation } from "./card-valuation.ts";

const gp = {
  fin_currency: "SGD",
  ebitda_amount: 1.28,
  sales_amount: 5.34,
};

test("formats EV, EBITDA, the implied multiple, and a sales multiple", () => {
  const result = cardValuation({ ...gp, enterprise_value: "S$12M" });
  assert.equal(result.line, "EV S$12.0m · EBITDA S$1.28m · 9.4× · 2.2× sales");
  assert.equal(
    result.title,
    "Expected valuation S$12.00m · EBITDA S$1.28m · 9.4× EBITDA · 2.2× sales (S$5.34m)",
  );
});

test("numeric strings still divide", () => {
  assert.equal(
    cardValuation({
      enterprise_value: "S$12M",
      fin_currency: "SGD",
      ebitda_amount: "1.28",
      sales_amount: "5.34",
    }).line,
    "EV S$12.0m · EBITDA S$1.28m · 9.4× · 2.2× sales",
  );
});

test("a bare millions figure uses the deal currency", () => {
  assert.equal(
    cardValuation({ ...gp, enterprise_value: "12" }).line,
    "EV S$12.0m · EBITDA S$1.28m · 9.4× · 2.2× sales",
  );
});

test("EBITDA alone still shows when enterprise value is missing", () => {
  for (const enterprise_value of [null, undefined, "", "   ", "—", "-", "n/a", "see IM"]) {
    const result = cardValuation({ ...gp, enterprise_value });
    assert.equal(result.line, "EBITDA S$1.28m", String(enterprise_value));
    assert.equal(result.title, "EBITDA S$1.28m", String(enterprise_value));
  }
});

test("sales without EV or EBITDA omits the line", () => {
  const result = cardValuation({
    enterprise_value: null,
    fin_currency: "SGD",
    ebitda_amount: null,
    sales_amount: 5.34,
  });
  assert.equal(result.line, null);
  assert.equal(result.title, null);
});

test("valuation alone when EBITDA is missing", () => {
  const result = cardValuation({
    enterprise_value: "US$12M",
    fin_currency: "USD",
    ebitda_amount: null,
    sales_amount: 0,
  });
  assert.equal(result.line, "EV US$12.0m");
  assert.equal(result.title, "Expected valuation US$12.00m");
});

test("negative and zero EBITDA are shown without an implied multiple", () => {
  assert.equal(
    cardValuation({
      enterprise_value: "S$10M",
      fin_currency: "SGD",
      ebitda_amount: -1.2,
      sales_amount: null,
    }).line,
    "EV S$10.0m · EBITDA S$-1.20m",
  );
  assert.equal(
    cardValuation({
      enterprise_value: null,
      fin_currency: "SGD",
      ebitda_amount: 0,
      sales_amount: 4,
    }).line,
    "EBITDA S$0.0m",
  );
  const withEv = cardValuation({
    enterprise_value: "S$10M",
    fin_currency: "SGD",
    ebitda_amount: 0,
    sales_amount: 4,
  });
  assert.equal(withEv.line, "EV S$10.0m · EBITDA S$0.0m · 2.5× sales");
  assert.equal(
    withEv.title,
    "Expected valuation S$10.00m · EBITDA S$0.00m · 2.5× sales (S$4.00m)",
  );
});

test("shows EBITDA and only the multiples that can be computed", () => {
  assert.equal(
    cardValuation({
      enterprise_value: "S$9.4M",
      fin_currency: "SGD",
      ebitda_amount: 1,
      sales_amount: null,
    }).line,
    "EV S$9.40m · EBITDA S$1.00m · 9.4×",
  );
  assert.equal(
    cardValuation({
      enterprise_value: "40",
      fin_currency: "MYR",
      ebitda_amount: null,
      sales_amount: 20,
    }).line,
    "EV RM 40.0m · 2.0× sales",
  );
});

test("currency written on the enterprise value wins over a different deal currency", () => {
  const result = cardValuation({
    enterprise_value: "US$10M",
    fin_currency: "SGD",
    ebitda_amount: 2,
    sales_amount: null,
  });
  assert.equal(result.line, "EV US$10.0m · EBITDA S$2.00m · 5.0×");
  assert.equal(result.title, "Expected valuation US$10.00m · EBITDA S$2.00m · 5.0× EBITDA");
});

test("multiples round to one decimal", () => {
  assert.equal(
    cardValuation({
      enterprise_value: "10",
      fin_currency: "SGD",
      ebitda_amount: 8,
      sales_amount: 4,
    }).line,
    "EV S$10.0m · EBITDA S$8.00m · 1.3× · 2.5× sales",
  );
});

test("larger valuations drop the decimal the same way other millions figures do", () => {
  assert.equal(
    cardValuation({
      enterprise_value: "S$266M",
      fin_currency: "SGD",
      ebitda_amount: null,
      sales_amount: null,
    }).line,
    "EV S$266m",
  );
});

test("unparsed EBITDA text still fills the card line", () => {
  assert.equal(
    cardValuation({
      enterprise_value: null,
      fin_currency: null,
      ebitda_amount: null,
      latest_ebitda: "~US$5M",
    }).line,
    "EBITDA US$5.00m",
  );
  assert.equal(
    cardValuation({
      enterprise_value: null,
      fin_currency: null,
      ebitda_amount: null,
      latest_ebitda: "THB805M",
    }).line,
    "EBITDA THB 805m",
  );
  assert.equal(
    cardValuation({
      enterprise_value: "RMB581M",
      fin_currency: null,
      ebitda_amount: null,
      latest_ebitda: "RMB146M",
    }).line,
    "EV RMB 581m · EBITDA RMB 146m · 4.0×",
  );
});

test("non-finite EBITDA is ignored", () => {
  assert.equal(
    cardValuation({
      enterprise_value: null,
      fin_currency: "SGD",
      ebitda_amount: "n/a",
      sales_amount: 3,
    }).line,
    null,
  );
});
