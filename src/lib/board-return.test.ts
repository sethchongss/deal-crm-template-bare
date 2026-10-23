import assert from "node:assert/strict";
import test from "node:test";
import {
  boardReturnPath,
  fullPageNavigation,
  fullPagePushTarget,
  parseKanbanScroll,
  readPipelineFilters,
  writePipelineFilters,
} from "./board-return.ts";

test("expanding a drawer returns to the same board without reopening the deal", () => {
  const search = "q=clinic&industry=Healthcare+%26+Biomedical&country=Singapore&proprietary=only&deal=abc";
  assert.equal(
    boardReturnPath("/", search),
    "/?q=clinic&industry=Healthcare+%26+Biomedical&country=Singapore&proprietary=only",
  );
  const nav = fullPageNavigation("/", search, "abc");
  assert.equal(nav.replace, boardReturnPath("/", search));
  assert.equal(nav.push, "/deals/abc");
  assert.equal(nav.replace.includes("deal="), false);
});

test("browser Back after expand lands on the board, not the open drawer", () => {
  const history = ["/?q=clinic&industry=Logistics&proprietary=only&deal=abc"];
  const nav = fullPageNavigation("/", history[0].slice(1), "abc");
  history[history.length - 1] = nav.replace;
  history.push(nav.push);
  assert.deepEqual(history, ["/?q=clinic&industry=Logistics&proprietary=only", "/deals/abc"]);
  history.pop();
  const back = history.at(-1) ?? "";
  assert.equal(back, "/?q=clinic&industry=Logistics&proprietary=only");
  const query = back.slice(back.indexOf("?") + 1);
  assert.equal(readPipelineFilters(query).q, "clinic");
  assert.equal(readPipelineFilters(query).proprietary, "only");
});

test("the full page is pushed only after the drawer param is gone", () => {
  assert.equal(fullPagePushTarget("abc", "/deals/abc"), null);
  assert.equal(fullPagePushTarget(null, "/deals/abc"), "/deals/abc");
  assert.equal(fullPagePushTarget(null, null), null);
});

test("a board with no filters returns to the bare path", () => {
  assert.equal(boardReturnPath("/", "deal=abc"), "/");
  assert.equal(boardReturnPath("/timeline", ""), "/timeline");
});

test("pipeline filters round-trip in the query and keep the open deal", () => {
  const search = writePipelineFilters("deal=abc", {
    q: "widgets",
    industry: "Logistics",
    country: "Singapore",
    proprietary: "only",
  });
  assert.equal(readPipelineFilters(search).q, "widgets");
  assert.equal(readPipelineFilters(search).industry, "Logistics");
  assert.equal(readPipelineFilters(search).country, "Singapore");
  assert.equal(readPipelineFilters(search).proprietary, "only");
  assert.match(search, /deal=abc/);
  const cleared = writePipelineFilters(search, { q: "", proprietary: "all" });
  assert.equal(readPipelineFilters(cleared).q, "");
  assert.equal(readPipelineFilters(cleared).proprietary, "all");
  assert.equal(readPipelineFilters(cleared).industry, "Logistics");
  assert.equal(readPipelineFilters("proprietary=nope").proprietary, "all");
});

test("kanban scroll restores finite column positions only", () => {
  assert.equal(parseKanbanScroll(null), null);
  assert.equal(parseKanbanScroll("{"), null);
  assert.deepEqual(parseKanbanScroll(JSON.stringify({ x: 40, columns: { pipeline: 120, passed: "no" } })), {
    x: 40,
    columns: { pipeline: 120 },
  });
});
