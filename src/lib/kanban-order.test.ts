import assert from "node:assert/strict";
import test from "node:test";
import { orderBoardDeals, passedFlagsAfterTierMove, placeAtTop, reindexAfterDrop, topSortOrder, topSortOrderForBoard, type KanbanOrderDeal, type KanbanOrderUpdate } from "./kanban-order.ts";

function deal(
  id: string,
  tier: KanbanOrderDeal["tier"],
  sort_order: number | null,
  archived = false,
  created_at: string | null = null,
  entry_date: string | null = null,
  passed_at: string | null = null,
): KanbanOrderDeal {
  return { id, tier, sort_order, archived, created_at, entry_date, passed_at };
}

function apply(deals: KanbanOrderDeal[], updates: KanbanOrderUpdate[]) {
  const next = deals.map((item) => ({ ...item }));
  for (const update of updates) {
    const item = next.find((row) => row.id === update.id);
    if (!item) continue;
    item.tier = update.tier;
    item.sort_order = update.sort_order;
  }
  return next;
}

function ids(deals: KanbanOrderDeal[], tier: KanbanOrderDeal["tier"] | "archive" = "pipeline") {
  const rows = tier === "archive" ? deals.filter((item) => item.archived) : deals.filter((item) => !item.archived && item.tier === tier);
  return orderBoardDeals(rows).map((item) => item.id);
}

test("reindexes both cards when a drop would otherwise share sort_order", () => {
  const deals = [
    deal("a", "pipeline", 0),
    deal("b", "pipeline", 0),
    deal("c", "pipeline", 5),
  ];
  const updates = reindexAfterDrop({
    deals,
    draggedId: "c",
    destinationTier: "pipeline",
    destinationIndex: 0,
    isVisible: () => true,
  });
  const order = ["c", "a", "b"];
  for (const [index, id] of order.entries()) {
    const update = updates.find((row) => row.id === id);
    assert.equal(update?.sort_order, index);
    assert.equal(update?.tier, "pipeline");
  }
  assert.deepEqual(ids(apply(deals, updates)), ["c", "a", "b"]);
});

test("moving across columns reindexes the source and the destination", () => {
  const deals = [
    deal("a", "active", 0),
    deal("b", "active", 4),
    deal("c", "pipeline", 2),
    deal("d", "pipeline", 9),
  ];
  const updates = reindexAfterDrop({
    deals,
    draggedId: "c",
    destinationTier: "active",
    destinationIndex: 1,
    isVisible: () => true,
  });
  assert.deepEqual(ids(apply(deals, updates), "active"), ["a", "c", "b"]);
  assert.deepEqual(ids(apply(deals, updates), "pipeline"), ["d"]);
  assert.deepEqual(
    updates.map((row) => [row.id, row.sort_order]),
    [["c", 1], ["b", 2], ["d", 0]],
  );
});

test("a filtered drop keeps hidden cards in their relative place", () => {
  const deals = [
    deal("hidden", "pipeline", 0),
    deal("visible-a", "pipeline", 1),
    deal("visible-b", "pipeline", 2),
  ];
  const updates = reindexAfterDrop({
    deals,
    draggedId: "visible-b",
    destinationTier: "pipeline",
    destinationIndex: 0,
    isVisible: (id) => id !== "hidden",
  });
  assert.deepEqual(ids(apply(deals, updates)), ["hidden", "visible-b", "visible-a"]);
});

test("a within-board drag renumbers that board and the new order sticks", () => {
  const deals = [
    deal("older", "pipeline", 0, false, "2024-01-01T00:00:00.000Z", "2024-01-01"),
    deal("newer", "pipeline", 1, false, "2026-06-01T00:00:00.000Z", "2026-06-01"),
  ];
  assert.deepEqual(ids(deals), ["older", "newer"]);
  const updates = reindexAfterDrop({
    deals,
    draggedId: "newer",
    destinationTier: "pipeline",
    destinationIndex: 0,
    isVisible: () => true,
  });
  assert.deepEqual(updates, [
    { id: "newer", tier: "pipeline", sort_order: 0 },
    { id: "older", tier: "pipeline", sort_order: 1 },
  ]);
  assert.deepEqual(ids(apply(deals, updates)), ["newer", "older"]);
});

test("a drag uses the on-screen order when sort_order ties on created_at", () => {
  const deals = [
    deal("older-created", "pipeline", 0, false, "2026-01-01T00:00:00.000Z"),
    deal("newer-created", "pipeline", 0, false, "2026-08-01T00:00:00.000Z"),
    deal("bottom", "pipeline", 5, false, "2026-12-01T00:00:00.000Z"),
  ];
  assert.deepEqual(ids(deals), ["newer-created", "older-created", "bottom"]);
  const updates = reindexAfterDrop({
    deals,
    draggedId: "bottom",
    destinationTier: "pipeline",
    destinationIndex: 1,
    isVisible: () => true,
  });
  assert.deepEqual(ids(apply(deals, updates)), ["newer-created", "bottom", "older-created"]);
});

test("archived deals are not moved by a board drop", () => {
  const deals = [deal("live", "pipeline", 3), deal("old", "passed", 0, true)];
  const updates = reindexAfterDrop({
    deals,
    draggedId: "old",
    destinationTier: "pipeline",
    destinationIndex: 0,
    isVisible: () => true,
  });
  assert.deepEqual(updates, []);
});

test("a button move writes only min sort_order minus one", () => {
  const deals = [
    deal("first", "passed", 0),
    deal("second", "passed", 4),
    deal("moved", "pipeline", 2),
    deal("archived", "passed", -5, true),
  ];
  const updates = placeAtTop({ deals, movingId: "moved", destinationTier: "passed" });
  assert.deepEqual(updates, [{ id: "moved", tier: "passed", sort_order: -1 }]);
  assert.deepEqual(ids(apply(deals, updates), "passed"), ["moved", "first", "second"]);
  assert.deepEqual(ids(apply(deals, updates), "pipeline"), []);
});

test("returning a passed deal lands at the top without rewriting the column", () => {
  const deals = [
    deal("live", "pipeline", 0),
    deal("next", "pipeline", 3),
    deal("moved", "passed", 1),
  ];
  const updates = placeAtTop({ deals, movingId: "moved", destinationTier: "pipeline" });
  assert.deepEqual(updates, [{ id: "moved", tier: "pipeline", sort_order: -1 }]);
  assert.deepEqual(ids(apply(deals, updates)), ["moved", "live", "next"]);
});

test("an empty board gives the first arrival sort_order 0", () => {
  const deals = [deal("moved", "pipeline", 8)];
  const updates = placeAtTop({ deals, movingId: "moved", destinationTier: "active" });
  assert.deepEqual(updates, [{ id: "moved", tier: "active", sort_order: 0 }]);
});

test("a drag to a lower slot keeps that position", () => {
  const deals = [
    deal("first", "passed", 0),
    deal("second", "passed", 1),
    deal("moved", "pipeline", 2),
  ];
  const updates = reindexAfterDrop({
    deals,
    draggedId: "moved",
    destinationTier: "passed",
    destinationIndex: 2,
    isVisible: () => true,
  });
  assert.deepEqual(updates, [{ id: "moved", tier: "passed", sort_order: 2 }]);
  assert.deepEqual(ids(apply(deals, updates), "passed"), ["first", "second", "moved"]);
});

test("a cross-board drop at the top renumbers instead of using min minus one", () => {
  const deals = [
    deal("first", "passed", 0),
    deal("second", "passed", 5),
    deal("moved", "pipeline", 2),
  ];
  const updates = reindexAfterDrop({
    deals,
    draggedId: "moved",
    destinationTier: "passed",
    destinationIndex: 0,
    isVisible: () => true,
  });
  assert.deepEqual(ids(apply(deals, updates), "passed"), ["moved", "first", "second"]);
  assert.equal(updates.find((row) => row.id === "moved")?.sort_order, 0);
  assert.equal(updates.find((row) => row.id === "second")?.sort_order, 2);
});

test("boards display sort_order ascending and created_at descending on a tie", () => {
  const deals = [
    deal("low", "active", 0, false, "2020-01-01T00:00:00.000Z", "2026-12-01"),
    deal("tie-older", "active", 2, false, "2026-01-01T00:00:00.000Z", "2026-06-01"),
    deal("tie-newer", "active", 2, false, "2026-08-01T00:00:00.000Z", "2024-01-01"),
    deal("high", "active", 9, false, "2026-12-01T00:00:00.000Z", "2020-01-01"),
  ];
  assert.deepEqual(ids(deals, "active"), ["low", "tie-newer", "tie-older", "high"]);
});

test("null sort_order sits after numbered cards, newest entry date first", () => {
  const deals = [
    deal("ranked", "active", 3, false, "2020-01-01T00:00:00.000Z", "2020-01-01"),
    deal("null-old", "active", null, false, "2026-09-01T00:00:00.000Z", "2024-01-01"),
    deal("null-new", "active", null, false, "2026-02-01T00:00:00.000Z", "2026-05-01"),
    deal("null-fallback", "active", null, false, "2026-03-01T00:00:00.000Z", null),
  ];
  assert.deepEqual(ids(deals, "active"), ["ranked", "null-new", "null-fallback", "null-old"]);
});

test("hand-set pipeline order wins until a new deal takes min minus one", () => {
  const deals = [
    deal("deal-a", "pipeline", 0, false, "2026-07-06T08:00:00.000Z", "2026-07-06"),
    deal("deal-b", "pipeline", 1, false, "2026-03-19T00:00:00.000Z", "2026-03-19"),
    deal("deal-c", "pipeline", 17, false, "2026-07-06T01:00:00.000Z", "2026-07-06"),
    deal("deal-h", "pipeline", 35, false, "2026-08-28T00:00:00.000Z", "2026-08-28"),
    deal("deal-g", "pipeline", 34, false, "2026-09-11T00:00:00.000Z", "2026-09-11"),
    deal("deal-f", "pipeline", 33, false, "2026-10-04T01:00:00.000Z", "2026-10-04"),
    deal("deal-e", "pipeline", 32, false, "2026-10-04T02:00:00.000Z", "2026-10-04"),
    deal("deal-d", "pipeline", 31, false, "2026-10-04T03:00:00.000Z", "2026-10-04"),
  ];
  assert.deepEqual(ids(deals), ["deal-a", "deal-b", "deal-c", "deal-d", "deal-e", "deal-f", "deal-g", "deal-h"]);
  const fresh = deal("fresh", "pipeline", topSortOrderForBoard(deals, "pipeline"), false, "2026-10-04T04:00:00.000Z", "2026-10-04");
  assert.equal(fresh.sort_order, -1);
  assert.deepEqual(ids([...deals, fresh]), ["fresh", "deal-a", "deal-b", "deal-c", "deal-d", "deal-e", "deal-f", "deal-g", "deal-h"]);
});

test("Passed / Out and the archive use sort_order, not the pass or entry date", () => {
  const passed = [
    deal("old-pass", "passed", 0, false, "2026-10-04T00:00:00.000Z", "2026-10-04", "2026-01-01T00:00:00.000Z"),
    deal("new-pass", "passed", 35, false, "2024-01-01T00:00:00.000Z", "2024-01-01", "2026-10-04T12:00:00.000Z"),
  ];
  assert.deepEqual(ids(passed, "passed"), ["old-pass", "new-pass"]);
  const placed = placeAtTop({
    deals: [...passed, deal("just-passed", "pipeline", 4, false, "2020-01-01T00:00:00.000Z", "2020-01-01")],
    movingId: "just-passed",
    destinationTier: "passed",
  });
  assert.deepEqual(placed, [{ id: "just-passed", tier: "passed", sort_order: -1 }]);

  const archived = [
    deal("older", "pipeline", 0, true, "2026-01-01T00:00:00.000Z", "2026-01-01"),
    deal("newer", "passed", 30, true, "2026-08-01T00:00:00.000Z", "2026-08-01"),
  ];
  assert.deepEqual(ids(archived, "archive"), ["older", "newer"]);
});

test("topSortOrder is one below the current minimum and ignores archived cards", () => {
  assert.equal(topSortOrder([]), 0);
  assert.equal(topSortOrder([0, 4, 2]), -1);
  assert.equal(topSortOrder([-2, 3]), -3);
  assert.equal(
    topSortOrderForBoard(
      [
        deal("live", "pipeline", 4),
        deal("filed", "pipeline", -8, true),
        deal("blank", "pipeline", null),
      ],
      "pipeline",
    ),
    3,
  );
});

test("moving to Passed marks the deal passed and leaves the stage decision to the caller", () => {
  assert.equal(passedFlagsAfterTierMove("pipeline", "passed"), "set");
  assert.equal(passedFlagsAfterTierMove("passed", "active"), "clear");
  assert.equal(passedFlagsAfterTierMove("passed", "pipeline"), "clear");
  assert.equal(passedFlagsAfterTierMove("pipeline", "active"), null);
  assert.equal(passedFlagsAfterTierMove("active", "active"), null);
});
