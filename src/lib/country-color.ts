import { COUNTRY_TONE } from "@/lib/tag-styles";

/** Country chips are one neutral style. The first country is still the label. */
export function primaryCountry(country: string | null | undefined) {
  if (!country) return "";
  return country.split("/")[0]?.trim() ?? "";
}

export function countryTone(_country?: string | null) {
  return COUNTRY_TONE;
}
