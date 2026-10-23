export type ProprietaryFilterValue = "all" | "only" | "exclude";

export function matchesProprietary(isProprietary: boolean | null | undefined, filter: ProprietaryFilterValue) {
  if (filter === "all") return true;
  return filter === "only" ? isProprietary === true : isProprietary !== true;
}
