import assert from "node:assert/strict";
import test from "node:test";
import { PROCESS_STEPS, checklistProgress, currentStep, groupChecklist, stepForWorkstream } from "@/lib/process-checklist";
import type { DealWorkstream } from "@/types/database";

const stream = (id: string, name: string, sort_order = 0): DealWorkstream => ({ id, deal_id: "d", name, sort_order, created_at: "2026-01-01T00:00:00.000Z" });
const task = (workstream_id: string, status: "done" | "not_started" | "in_motion", sort_order = 0) => ({ workstream_id, status, sort_order });

test("the checklist runs screening to close in order", () => {
  assert.deepEqual(PROCESS_STEPS.map((step) => step.name), ["Screening", "First call", "NDA", "Model", "Due diligence", "IC", "Close"]);
});

test("progress counts done items", () => {
  assert.deepEqual(checklistProgress([]), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(checklistProgress([task("a", "done"), task("a", "in_motion"), task("a", "not_started")]), { done: 1, total: 3, percent: 33 });
});

test("workstreams match steps by name or alias", () => {
  assert.equal(stepForWorkstream("Diligence")?.key, "dd");
  assert.equal(stepForWorkstream(" investment committee ")?.key, "ic");
  assert.equal(stepForWorkstream("Financing"), null);
});

test("tasks group under their step and unknown workstreams go to other", () => {
  const { steps, other } = groupChecklist(
    [stream("s", "Screening"), stream("n", "NDA", 1), stream("f", "Financing", 2)],
    [task("s", "done"), task("s", "done"), task("n", "not_started"), task("f", "done")],
  );
  assert.equal(steps[0].progress.percent, 100);
  assert.equal(steps[2].progress.total, 1);
  assert.equal(steps[1].tasks.length, 0);
  assert.equal(other?.tasks.length, 1);
  assert.equal(currentStep(steps), "NDA");
});
