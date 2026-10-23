import assert from "node:assert/strict";
import test from "node:test";
import { latestUpdateAfterDelete, latestUpdateAfterEdit, latestUpdateFromNote } from "./latest-update.ts";

test("a latest-update submission is a note and the stored latest update", () => {
  const at = new Date("2026-10-03T08:00:00.000Z");
  const submission = latestUpdateFromNote("  SPA signed today  ", at);
  assert.ok(submission);
  assert.equal(submission.content, "SPA signed today");
  assert.equal(submission.patch.latest_update, "SPA signed today");
  assert.equal(submission.patch.latest_update_at, "2026-10-03T08:00:00.000Z");
});

test("an empty composer does not clear the stored latest update", () => {
  assert.equal(latestUpdateFromNote("   "), null);
  assert.equal(latestUpdateFromNote(""), null);
});

test("editing the newest note rewrites the stored update and older notes do not", () => {
  assert.equal(latestUpdateAfterEdit(true, "SPA signed", "Teaser received"), "SPA signed");
  assert.equal(latestUpdateAfterEdit(false, "typo fixed", "SPA signed"), "SPA signed");
});

test("deleting the newest note falls back to the previous note", () => {
  const patch = latestUpdateAfterDelete(true, { content: "Teaser received", created_at: "2026-10-01T00:00:00.000Z" });
  assert.deepEqual(patch, {
    latest_update: "Teaser received",
    latest_update_at: "2026-10-01T00:00:00.000Z",
  });
  assert.deepEqual(latestUpdateAfterDelete(true, null), { latest_update: null, latest_update_at: null });
  assert.equal(latestUpdateAfterDelete(false, { content: "Older", created_at: "2026-09-01T00:00:00.000Z" }), null);
});
