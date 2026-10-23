import { Tag } from "@/components/tag";
import { countryTone } from "@/lib/country-color";
import { countryLabel } from "@/lib/format";

export function CountryChip({ country }: { country: string | null | undefined }) {
  const label = countryLabel(country);
  if (!label) return null;
  return <Tag tone={countryTone(country)}>{label}</Tag>;
}
