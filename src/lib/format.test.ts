import assert from "node:assert/strict";
import test from "node:test";
import { dealLoggedOn, loggedAge, loggedAgeTitle } from "./format.ts";

const now = new Date(2026, 9, 4, 12, 0, 0);

test("logged age is today, then days, weeks, months, and years", () => {
  assert.equal(loggedAge("2026-10-04", now), "Today");
  assert.equal(loggedAge("2026-10-05", now), "Today");
  assert.equal(loggedAge("2026-10-03", now), "1 day");
  assert.equal(loggedAge("2026-09-27", now), "7 days");
  assert.equal(loggedAge("2026-09-21", now), "13 days");
  assert.equal(loggedAge("2026-09-20", now), "2 wks");
  assert.equal(loggedAge("2026-08-23", now), "6 wks");
  assert.equal(loggedAge("2026-08-05", now), "8 wks");
  assert.equal(loggedAge("2026-08-04", now), "2 mo");
  assert.equal(loggedAge("2025-11-04", now), "11 mo");
  assert.equal(loggedAge("2025-10-04", now), "1 yr");
  assert.equal(loggedAge("2025-10-01", now), "1 yr");
  assert.equal(loggedAge("2025-07-04", now), "1 yr 3 mo");
  assert.equal(loggedAge("2024-10-04", now), "2 yr");
  assert.equal(loggedAge("2024-09-04", now), "2 yr 1 mo");
});

test("logged age ignores blank and unreadable dates", () => {
  assert.equal(loggedAge(null, now), null);
  assert.equal(loggedAge("", now), null);
  assert.equal(loggedAge("not-a-date", now), null);
  assert.equal(loggedAgeTitle(null), null);
  assert.equal(loggedAgeTitle("not-a-date"), null);
});

test("logged age title is the calendar day the deal was logged", () => {
  assert.equal(loggedAgeTitle("2025-10-01"), "Logged 1 Oct 2025");
  assert.equal(loggedAgeTitle("2025-10-01T12:00:00.000Z"), "Logged 1 Oct 2025");
});

test("a missing entry date falls back to created_at", () => {
  assert.equal(dealLoggedOn("2025-10-01", "2026-01-15T00:00:00.000Z"), "2025-10-01");
  assert.equal(dealLoggedOn(null, "2026-01-15T00:00:00.000Z"), "2026-01-15T00:00:00.000Z");
  assert.equal(dealLoggedOn("", "2026-01-15"), "2026-01-15");
  assert.equal(dealLoggedOn("   ", "2025-10-01"), "2025-10-01");
  assert.equal(dealLoggedOn("not-a-date", "2025-10-01"), "2025-10-01");
  assert.equal(dealLoggedOn(null, null), null);
  assert.equal(loggedAge(dealLoggedOn(null, "2025-10-01"), now), "1 yr");
  assert.equal(loggedAge(dealLoggedOn("2026-10-03", "2025-01-01"), now), "1 day");
});

test("a year is counted from the calendar day, even when the timestamp is late", () => {
  const created = new Date(2025, 9, 1, 23, 30, 0);
  const morning = new Date(2026, 9, 1, 9, 0, 0);
  assert.equal(loggedAge(created.toISOString(), morning), "1 yr");
  assert.equal(loggedAgeTitle(created.toISOString()), "Logged 1 Oct 2025");
});

test("two years and eleven months stay compact", () => {
  assert.equal(loggedAge("2025-10-01", new Date(2028, 8, 1)), "2 yr 11 mo");
});
