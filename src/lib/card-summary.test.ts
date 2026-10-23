import assert from "node:assert/strict";
import test from "node:test";
import { cardSummary } from "./card-summary.ts";

test("cuts a parenthetical product list before the first clause ends", () => {
  const summary = cardSummary(
    "Example-based maker of blue widgets (small, medium, large); sells across Exampleland",
  );
  assert.equal(summary, "Example-based maker of blue widgets");
});

test("cuts at the first sentence when that is the earliest clean phrase", () => {
  const summary = cardSummary(
    "Example-based provider of widget servicing solutions. 10+ years established.",
  );
  assert.equal(summary, "Example-based provider of widget servicing solutions");
});

test("does not split on Ltd. or single-letter initials", () => {
  assert.equal(
    cardSummary("Company B Pte Ltd. Widget rental provider with a 100-unit fleet. 90% utilisation."),
    "Company B Pte Ltd. Widget rental provider with a 100-unit fleet",
  );
  assert.equal(
    cardSummary("A.B. Company D Pte Ltd is a Singapore-based service line B services company."),
    "A.B. Company D Pte Ltd is a Singapore-based service line B services company",
  );
});

test("skips a parenthetical when the text before it is too short to be a phrase", () => {
  assert.equal(
    cardSummary("Company C (Singapore) builds regional power systems for factories. Second sentence stays off the card."),
    "Company C (Singapore) builds regional power systems for factories",
  );
});

test("does not split a decimal and still ends the sentence", () => {
  assert.equal(
    cardSummary("Runs a network with 12.5 percent share of the regional market. More follows later."),
    "Runs a network with 12.5 percent share of the regional market",
  );
});

test("uses a semicolon when the clause before it is a clean phrase", () => {
  assert.equal(
    cardSummary("Makes green widgets for factories; also builds gadgets and gizmos."),
    "Makes green widgets for factories",
  );
});

test("returns the collapsed description when nothing clean comes earlier", () => {
  assert.equal(cardSummary("Widgets; regional maker"), "Widgets; regional maker");
  assert.equal(cardSummary("  Family   bakery\nacross Johor  "), "Family bakery across Johor");
});

test("returns null when there is no description", () => {
  assert.equal(cardSummary(null), null);
  assert.equal(cardSummary(undefined), null);
  assert.equal(cardSummary("   "), null);
  assert.equal(cardSummary(""), null);
});
