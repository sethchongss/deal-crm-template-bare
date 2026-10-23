export type KanbanTier = "active_tier_1" | "active_tier_2" | "pipeline" | "passed";

export type BoardOrderDeal = {
  id: string;
  sort_order?: number | null;
  created_at?: string | null;
  entry_date?: string | null;
  passed_at?: string | null;
};

export type KanbanOrderDeal = BoardOrderDeal & {
  tier: KanbanTier;
  archived: boolean;
  sort_order: number | null;
};

export type KanbanOrderUpdate = {
  id: string;
  tier: KanbanTier;
  sort_order: number;
};

/**
 * Passed is separate from deal_stage. Moving onto Passed / Out marks the deal
 * passed and leaves the stage alone. Moving back onto an active board clears
 * passed and still leaves the stage alone. Null means this drop is not a
 * passed-state change.
 */
export function passedFlagsAfterTierMove(fromTier: KanbanTier, toTier: KanbanTier): "set" | "clear" | null {
  if (fromTier === toTier) return null;
  if (toTier === "passed") return "set";
  if (fromTier === "passed") return "clear";
  return null;
}

function timeValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

function finiteSortOrder(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Newest created_at first. Equal or missing timestamps fall back to id. */
function compareCreatedDesc(a: BoardOrderDeal, b: BoardOrderDeal): number {
  const aCreated = timeValue(a.created_at) ?? Number.NEGATIVE_INFINITY;
  const bCreated = timeValue(b.created_at) ?? Number.NEGATIVE_INFINITY;
  if (aCreated !== bCreated) return bCreated - aCreated;
  return a.id.localeCompare(b.id);
}

/** entry_date, then created_at. Used only for cards with no sort_order. */
function compareReceivedDesc(a: BoardOrderDeal, b: BoardOrderDeal): number {
  const aEntry = timeValue(a.entry_date);
  const bEntry = timeValue(b.entry_date);
  const aCreated = timeValue(a.created_at);
  const bCreated = timeValue(b.created_at);
  const aPrimary = aEntry ?? aCreated ?? Number.NEGATIVE_INFINITY;
  const bPrimary = bEntry ?? bCreated ?? Number.NEGATIVE_INFINITY;
  if (aPrimary !== bPrimary) return bPrimary - aPrimary;
  return compareCreatedDesc(a, b);
}

/**
 * Board order: sort_order ascending, then created_at descending. Cards with
 * no sort_order sit after the numbered ones, newest entry_date / created_at
 * first among themselves.
 */
export function compareBoardOrder(a: BoardOrderDeal, b: BoardOrderDeal): number {
  const aOrder = finiteSortOrder(a.sort_order);
  const bOrder = finiteSortOrder(b.sort_order);
  if (aOrder != null && bOrder != null) {
    if (aOrder !== bOrder) return aOrder - bOrder;
    return compareCreatedDesc(a, b);
  }
  if (aOrder != null) return -1;
  if (bOrder != null) return 1;
  return compareReceivedDesc(a, b);
}

/** Visible order for every board, including Passed / Out and the archive. */
export function orderBoardDeals<T extends BoardOrderDeal>(deals: T[]): T[] {
  return [...deals].sort(compareBoardOrder);
}

/** sort_order for a deal that should sit at the top of an ascending rank. */
export function topSortOrder(sortOrders: number[]): number {
  if (sortOrders.length === 0) return 0;
  return Math.min(...sortOrders) - 1;
}

/** Lowest live sort_order on a board, minus one. Archived cards are not on the board. */
export function topSortOrderForBoard(
  deals: { id?: string; tier?: string | null; archived?: boolean | null; sort_order?: number | null }[],
  tier: string,
  exceptId?: string,
): number {
  const orders = deals.flatMap((deal) => {
    if (deal.archived === true || deal.tier !== tier || deal.id === exceptId) return [];
    const value = finiteSortOrder(deal.sort_order);
    return value == null ? [] : [value];
  });
  return topSortOrder(orders);
}

/**
 * Reindex the source and destination columns after a drag.
 * destinationIndex is the index in the filtered destination column, using
 * hello-pangea/dnd's rule (the item is already removed from a same-column list).
 * Hidden cards keep their relative place around the visible ones.
 * Both columns are rewritten to 0..n-1 in the order on screen.
 */
export function reindexAfterDrop(input: {
  deals: KanbanOrderDeal[];
  draggedId: string;
  destinationTier: KanbanTier;
  destinationIndex: number;
  isVisible: (id: string) => boolean;
}): KanbanOrderUpdate[] {
  const dragged = input.deals.find((deal) => deal.id === input.draggedId);
  if (!dragged || dragged.archived) return [];

  const column = (tier: KanbanTier) =>
    orderBoardDeals(
      input.deals.filter((deal) => !deal.archived && deal.tier === tier && deal.id !== input.draggedId),
    );

  const sourceTier = dragged.tier;
  const sourceList = column(sourceTier);
  let destinationList = sourceTier === input.destinationTier ? [...sourceList] : column(input.destinationTier);

  const visible = destinationList.filter((deal) => input.isVisible(deal.id));
  let insertAt: number;
  if (input.destinationIndex >= visible.length) {
    if (visible.length === 0) {
      insertAt = destinationList.length;
    } else {
      const lastVisible = visible[visible.length - 1];
      insertAt = destinationList.findIndex((deal) => deal.id === lastVisible.id) + 1;
    }
  } else {
    const anchor = visible[input.destinationIndex];
    insertAt = destinationList.findIndex((deal) => deal.id === anchor.id);
    if (insertAt < 0) insertAt = destinationList.length;
  }

  destinationList = [
    ...destinationList.slice(0, insertAt),
    { ...dragged, tier: input.destinationTier },
    ...destinationList.slice(insertAt),
  ];

  const updates: KanbanOrderUpdate[] = [];
  destinationList.forEach((deal, index) => {
    if (deal.id === dragged.id || deal.sort_order !== index || deal.tier !== input.destinationTier) {
      updates.push({ id: deal.id, tier: input.destinationTier, sort_order: index });
    }
  });

  if (sourceTier !== input.destinationTier) {
    sourceList.forEach((deal, index) => {
      if (deal.sort_order !== index) {
        updates.push({ id: deal.id, tier: sourceTier, sort_order: index });
      }
    });
  }

  return updates;
}

/**
 * Create, board select, mark passed, and return to a board. Only the moving
 * card is written: its sort_order becomes one below the live minimum on the
 * destination, so it lands on top without renumbering the rest of the column.
 * A drag uses reindexAfterDrop and keeps the drop index.
 */
export function placeAtTop(input: {
  deals: KanbanOrderDeal[];
  movingId: string;
  destinationTier: KanbanTier;
}): KanbanOrderUpdate[] {
  const moving = input.deals.find((deal) => deal.id === input.movingId);
  if (!moving || moving.archived) return [];
  const sortOrder = topSortOrderForBoard(input.deals, input.destinationTier, moving.id);
  if (moving.tier === input.destinationTier && moving.sort_order === sortOrder) return [];
  return [{ id: moving.id, tier: input.destinationTier, sort_order: sortOrder }];
}
