import type { ProprietaryFilterValue } from "@/lib/proprietary";

const selectClass = "h-8 rounded-full border border-border bg-card px-3 text-xs";

export function ProprietaryFilter({
  value,
  onChange,
}: {
  value: ProprietaryFilterValue;
  onChange: (value: ProprietaryFilterValue) => void;
}) {
  return (
    <select
      aria-label="Proprietary"
      className={selectClass}
      value={value}
      onChange={(event) => onChange(event.target.value as ProprietaryFilterValue)}
    >
      <option value="all">Proprietary: All</option>
      <option value="only">Proprietary only</option>
      <option value="exclude">Non-proprietary</option>
    </select>
  );
}
