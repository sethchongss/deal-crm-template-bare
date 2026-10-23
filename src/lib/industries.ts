/**
 * Fixed industry list for deals.
 * EnterpriseSG industries, plus Education, Consumer & Lifestyle,
 * Hospitality & Tourism, and Financial Services & Real Estate.
 * Edit this list in one place; the database check constraint is the same set.
 */

export const INDUSTRIES = [
  "Agritech",
  "Air Transport",
  "Built Environment",
  "Business Services",
  "Electronics",
  "Energy & Chemicals",
  "Food Manufacturing",
  "Food Services",
  "Healthcare & Biomedical",
  "ICT & Media",
  "Land Transport",
  "Logistics",
  "Marine & Offshore Energy",
  "Precision Engineering",
  "Retail",
  "Sea Transport",
  "Urban Solutions",
  "Wholesale Trade",
  "Education",
  "Consumer & Lifestyle",
  "Hospitality & Tourism",
  "Financial Services & Real Estate",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export function matchIndustry(value: string | null | undefined): Industry | null {
  const key = value?.trim().toLowerCase();
  if (!key) return null;
  return INDUSTRIES.find((item) => item.toLowerCase() === key) ?? null;
}

export function industrySlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
