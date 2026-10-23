import type { ProprietaryFilterValue } from "@/lib/proprietary";

/** sessionStorage key for the board URL to restore after a full-page deal. */
export const DEAL_RETURN_KEY = "deal-full-page-return";

/** Set while the drawer entry is being replaced, so the shell can then push the full page. */
export const DEAL_EXPAND_KEY = "deal-full-page-expand";

/** sessionStorage key for kanban column and row scroll. */
export const KANBAN_SCROLL_KEY = "kanban-scroll";

export type KanbanScroll = { x: number; columns: Record<string, number> };

export type PipelineFilters = {
  q: string;
  industry: string;
  country: string;
  proprietary: ProprietaryFilterValue;
};

/**
 * Board URL with the drawer deal param removed.
 * Expanding the drawer pushes /deals/[id]; this is the entry browser Back should land on.
 */
export function boardReturnPath(pathname: string, search: string) {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  params.delete("deal");
  const next = params.toString();
  const path = pathname || "/";
  return next ? `${path}?${next}` : path;
}

/** Replace the open-drawer history entry, then push the full deal page. */
export function fullPageNavigation(pathname: string, search: string, dealId: string) {
  return {
    replace: boardReturnPath(pathname, search),
    push: `/deals/${dealId}`,
  };
}

/** Push the full page only after the drawer param is gone, so it sits on top of the board entry. */
export function fullPagePushTarget(dealParam: string | null, expandTarget: string | null) {
  if (!expandTarget || dealParam) return null;
  return expandTarget;
}

export function readPipelineFilters(search: string): PipelineFilters {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const proprietary = params.get("proprietary");
  return {
    q: params.get("q") ?? "",
    industry: params.get("industry") ?? "",
    country: params.get("country") ?? "",
    proprietary: proprietary === "only" || proprietary === "exclude" ? proprietary : "all",
  };
}

/** Merge filter fields into the current query. Other params, including deal, stay. */
export function writePipelineFilters(search: string, patch: Partial<PipelineFilters>) {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const apply = (key: string, value: string | undefined, empty: string) => {
    if (value === undefined) return;
    if (!value || value === empty) params.delete(key);
    else params.set(key, value);
  };
  apply("q", patch.q, "");
  apply("industry", patch.industry, "");
  apply("country", patch.country, "");
  apply("proprietary", patch.proprietary, "all");
  return params.toString();
}

export function parseKanbanScroll(raw: string | null): KanbanScroll | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<KanbanScroll>;
    if (typeof parsed.x !== "number" || !Number.isFinite(parsed.x) || !parsed.columns || typeof parsed.columns !== "object") return null;
    const columns: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed.columns)) {
      if (typeof value === "number" && Number.isFinite(value)) columns[key] = value;
    }
    return { x: parsed.x, columns };
  } catch {
    return null;
  }
}
