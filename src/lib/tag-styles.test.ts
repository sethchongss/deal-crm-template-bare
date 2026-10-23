import assert from "node:assert/strict";
import test from "node:test";
import { INDUSTRIES } from "./industries.ts";
import {
  COUNTRY_TONE,
  PASSED_TONE,
  PROPRIETARY_TONE,
  STAGE_TONE,
  TAG_CLASS,
  TAG_TONES,
  TIER_TONE,
  industryClass,
  statusTones,
} from "./tag-styles.ts";

test("status tags are distinct and the palette has no red", () => {
  assert.equal("red" in TAG_CLASS, false);
  assert.equal(Object.keys(TAG_CLASS).includes("red"), false);
  for (const tone of ["slate", "indigo", "plum"]) {
    assert.equal(TAG_TONES.includes(tone as (typeof TAG_TONES)[number]), false);
  }
  assert.equal(new Set(Object.values(STAGE_TONE)).size, Object.keys(STAGE_TONE).length);
  assert.equal(new Set(Object.values(TIER_TONE)).size, Object.keys(TIER_TONE).length);
  assert.equal(PROPRIETARY_TONE, "plum");
  assert.equal(PASSED_TONE, "slate");
  assert.equal(TIER_TONE.passed, "slate");
  assert.equal(STAGE_TONE.Passed, "slate");
  assert.equal(COUNTRY_TONE, "neutral");
  assert.equal(statusTones().includes(PROPRIETARY_TONE), true);
});

test("each industry has its own chip class, separate from status tags", () => {
  const classes = INDUSTRIES.map((industry) => industryClass(industry));
  assert.equal(new Set(classes).size, INDUSTRIES.length);
  for (const chip of classes) {
    assert.match(chip, /^ind-/);
    assert.equal(Object.values(TAG_CLASS).includes(chip), false);
  }
  assert.equal(industryClass(null), TAG_CLASS.neutral);
  assert.equal(industryClass("Not a real industry"), TAG_CLASS.neutral);
});
