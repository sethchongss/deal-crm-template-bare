/**
 * Sector group and country normalisation.
 * The SQL lookup in supabase/migrations/20261003130200_sector_country.sql
 * must contain the same pairs. Tests read that file and compare.
 */

export type SectorMapping = {
  sector_group: string;
  /** Cleaned original subsector. The deals.sector column is left untouched. */
  sector_detail: string;
};

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const GROUPS = {
  equipment: "Equipment Rental",
  healthcare: "Healthcare",
  education: "Education",
  logistics: "Logistics",
  industrial: "Industrial Services",
  building: "Building & Facilities",
  food: "Food & Agri",
  fitness: "Fitness & Wellness",
  technology: "Technology",
  distribution: "Distribution",
  energy: "Energy",
  consumer: "Consumer",
  media: "Media & Entertainment",
  hospitality: "Hospitality",
  security: "Security",
  chemicals: "Chemicals & Materials",
  marine: "Marine",
} as const;

/** Generic sector labels, keyed by the original string. Add your own subsectors here and in the SQL lookup. */
export const SECTOR_MAP: Record<string, SectorMapping> = {
  "Equipment Rental": { sector_group: GROUPS.equipment, sector_detail: "Equipment Rental" },
  "Healthcare": { sector_group: GROUPS.healthcare, sector_detail: "Healthcare" },
  "Education": { sector_group: GROUPS.education, sector_detail: "Education" },
  "Logistics": { sector_group: GROUPS.logistics, sector_detail: "Logistics" },
  "Industrial Services": { sector_group: GROUPS.industrial, sector_detail: "Industrial Services" },
  "Building & Facilities": { sector_group: GROUPS.building, sector_detail: "Building & Facilities" },
  "Food & Agri": { sector_group: GROUPS.food, sector_detail: "Food & Agri" },
  "Fitness & Wellness": { sector_group: GROUPS.fitness, sector_detail: "Fitness & Wellness" },
  "Technology": { sector_group: GROUPS.technology, sector_detail: "Technology" },
  "Distribution": { sector_group: GROUPS.distribution, sector_detail: "Distribution" },
  "Energy": { sector_group: GROUPS.energy, sector_detail: "Energy" },
  "Consumer": { sector_group: GROUPS.consumer, sector_detail: "Consumer" },
  "Media & Entertainment": { sector_group: GROUPS.media, sector_detail: "Media & Entertainment" },
  "Hospitality": { sector_group: GROUPS.hospitality, sector_detail: "Hospitality" },
  "Security": { sector_group: GROUPS.security, sector_detail: "Security" },
  "Chemicals & Materials": { sector_group: GROUPS.chemicals, sector_detail: "Chemicals & Materials" },
  "Marine": { sector_group: GROUPS.marine, sector_detail: "Marine" },
};

export const SECTOR_GROUPS = [...new Set(Object.values(SECTOR_MAP).map((item) => item.sector_group))].sort();

export function normalizeSector(sector: string | null | undefined): {
  sector_group: string | null;
  sector_detail: string | null;
} {
  if (sector == null) return { sector_group: null, sector_detail: null };
  const detail = clean(sector);
  if (!detail) return { sector_group: null, sector_detail: null };
  const mapped = SECTOR_MAP[detail] ?? SECTOR_MAP[sector];
  if (!mapped) return { sector_group: null, sector_detail: detail };
  return { sector_group: mapped.sector_group, sector_detail: mapped.sector_detail };
}

/** 'Malaysia / Indonesia' → ['Malaysia', 'Indonesia']; blank → null. */
export function normalizeCountries(country: string | null | undefined): string[] | null {
  if (country == null) return null;
  const parts = country
    .split("/")
    .map((part) => clean(part))
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

export const COUNTRY_ISO: Record<string, string> = {
  Singapore: "SG",
  Indonesia: "ID",
  Malaysia: "MY",
  Vietnam: "VN",
  Philippines: "PH",
  "Hong Kong": "HK",
  Australia: "AU",
  Thailand: "TH",
  Germany: "DE",
  Belgium: "BE",
  Croatia: "HR",
  Italy: "IT",
  Spain: "ES",
  UK: "GB",
  "United Kingdom": "GB",
};

export function countryCode(name: string): string | null {
  return COUNTRY_ISO[name] ?? null;
}

export function countryFlag(name: string): string | null {
  const code = countryCode(name);
  if (!code) return null;
  return [...code.toUpperCase()].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
}
