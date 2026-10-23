import assert from "node:assert/strict";
import test from "node:test";
import {
  STANDARD_TEMPLATE,
  applyTaskDatePatch,
  dragTaskDates,
  isDateChoiceAllowed,
  monthGrid,
  taskDateError,
  templateDate,
} from "./task-dates.ts";

test("standard template offsets are days from the apply date", () => {
  const rows = STANDARD_TEMPLATE.flatMap((stream) =>
    stream.tasks.map((task) => [stream.name, task.title, task.start, task.end, task.end - task.start, Boolean(task.milestone)]),
  );
  assert.deepEqual(rows, [
    ["Documents", "Term sheet", 0, 7, 7, true],
    ["Documents", "SPA and SHA", 7, 28, 21, false],
    ["Documents", "Signing", 28, 35, 7, true],
    ["Documents", "Completion", 42, 42, 0, true],
    ["Financing", "Lender outreach", 0, 14, 14, false],
    ["Financing", "Credit approval", 14, 35, 21, false],
    ["Financing", "Facility documents", 28, 42, 14, false],
    ["Diligence", "Legal diligence", 0, 21, 21, false],
    ["Diligence", "Financial diligence", 0, 21, 21, false],
    ["Family and company", "Vendor position", 0, 7, 7, true],
    ["Family and company", "Management handover", 14, 35, 21, false],
  ]);
});

test("template dates are the apply day plus the offset, stored as a UTC day", () => {
  const morning = new Date(2026, 9, 3, 9, 0, 0);
  const plusSeven = new Date(morning);
  plusSeven.setDate(plusSeven.getDate() + 7);
  assert.equal(templateDate(0, morning), morning.toISOString().slice(0, 10));
  assert.equal(templateDate(7, morning), plusSeven.toISOString().slice(0, 10));
  assert.equal(templateDate(42, morning), new Date(2026, 9, 3 + 42, 9, 0, 0).toISOString().slice(0, 10));
});

test("a later anchor does not rewrite a date that was already computed", () => {
  const applied = templateDate(7, new Date(2026, 9, 3, 9, 0, 0));
  const later = templateDate(7, new Date(2026, 10, 1, 9, 0, 0));
  assert.notEqual(applied, later);
  assert.equal(applied, templateDate(7, new Date(2026, 9, 3, 9, 0, 0)));
});

test("end date must be on or after the start date, and either date can be cleared", () => {
  assert.equal(taskDateError("2026-10-03", "2026-10-10"), null);
  assert.equal(taskDateError("2026-10-10", "2026-10-10"), null);
  assert.equal(taskDateError("2026-10-10", "2026-10-03"), "End date must be on or after the start date.");
  assert.equal(taskDateError(null, "2026-10-03"), null);
  assert.equal(taskDateError("2026-10-03", null), null);

  const current = { start: "2026-10-03", end: "2026-10-10" };
  assert.deepEqual(applyTaskDatePatch(current, { end_date: "2026-10-02" }), {
    ok: false,
    error: "End date must be on or after the start date.",
  });
  assert.deepEqual(applyTaskDatePatch(current, { start_date: null }), { ok: true, start: null, end: "2026-10-10" });
  assert.deepEqual(applyTaskDatePatch(current, { end_date: null }), { ok: true, start: "2026-10-03", end: null });
  assert.deepEqual(applyTaskDatePatch(current, { end_date: "2026-10-03" }), {
    ok: true,
    start: "2026-10-03",
    end: "2026-10-03",
  });
});

test("calendar days before the start or after the end cannot be chosen", () => {
  assert.equal(isDateChoiceAllowed("end", "2026-10-02", "2026-10-03", "2026-10-10"), false);
  assert.equal(isDateChoiceAllowed("end", "2026-10-03", "2026-10-03", "2026-10-10"), true);
  assert.equal(isDateChoiceAllowed("start", "2026-10-11", "2026-10-03", "2026-10-10"), false);
  assert.equal(isDateChoiceAllowed("start", "2026-10-10", "2026-10-03", "2026-10-10"), true);
  assert.equal(isDateChoiceAllowed("end", "2026-01-01", null, null), true);
  assert.equal(isDateChoiceAllowed("start", "2026-01-01", "2026-10-10", "2026-10-03"), true);
});

test("dragging a bar cannot put the end before the start", () => {
  assert.deepEqual(dragTaskDates("2026-10-03", "2026-10-10", "move", 2), {
    start_date: "2026-10-05",
    end_date: "2026-10-12",
  });
  assert.deepEqual(dragTaskDates("2026-10-03", "2026-10-10", "start", 20), {
    start_date: "2026-10-10",
    end_date: "2026-10-10",
  });
  assert.deepEqual(dragTaskDates("2026-10-03", "2026-10-10", "end", -20), {
    start_date: "2026-10-03",
    end_date: "2026-10-03",
  });
  assert.deepEqual(dragTaskDates("2026-10-03", null, "move", 1), {
    start_date: "2026-10-04",
    end_date: null,
  });
});

test("month grid starts on Monday", () => {
  const weeks = monthGrid(2026, 10);
  assert.equal(weeks[0][0].iso, "2026-09-28");
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[0][3].iso, "2026-10-01");
  assert.equal(weeks[0][3].inMonth, true);
  assert.equal(weeks.every((week) => week.length === 7), true);
});
