import assert from "node:assert/strict";
import test from "node:test";
import { countryTone, primaryCountry } from "./country-color.ts";

test("every country uses the same neutral chip", () => {
  for (const country of ["Singapore", "Malaysia", "AU", "Singapore / Australia", "Japan", "", null]) {
    assert.equal(countryTone(country), "neutral");
  }
});

test("a multi-country value still uses the first country as its name", () => {
  assert.equal(primaryCountry("Singapore / Australia"), "Singapore");
  assert.equal(primaryCountry(""), "");
});
