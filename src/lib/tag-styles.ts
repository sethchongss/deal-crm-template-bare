import type { DealStage, DealTier } from "@/types/database";
import { INDUSTRIES, industrySlug, type Industry } from "@/lib/industries";

/**
 * One palette for the whole app.
 * Status tags (board, stage, proprietary, passed) each have their own colour.
 * Industry chips use a separate set, so they never match a status tag.
 * Countries and sub-sector text stay neutral. Nothing here is red.
 */
export type TagTone =
  | "blue"
  | "purple"
  | "green"
  | "moss"
  | "orange"
  | "amber"
  | "teal"
  | "yellow"
  | "slate"
  | "indigo"
  | "plum"
  | "neutral";

/** Hash pool for leftover freeform chips. Status-only tones stay out of it. */
export const TAG_TONES: TagTone[] = ["blue", "purple", "green", "moss", "orange", "amber", "teal", "yellow", "neutral"];

export const TAG_CLASS: Record<TagTone, string> = {
  blue: "border-[var(--tag-blue-border)] bg-[var(--tag-blue-bg)] text-[var(--tag-blue-text)]",
  purple: "border-[var(--tag-purple-border)] bg-[var(--tag-purple-bg)] text-[var(--tag-purple-text)]",
  green: "border-[var(--tag-green-border)] bg-[var(--tag-green-bg)] text-[var(--tag-green-text)]",
  moss: "border-[var(--tag-moss-border)] bg-[var(--tag-moss-bg)] text-[var(--tag-moss-text)]",
  orange: "border-[var(--tag-orange-border)] bg-[var(--tag-orange-bg)] text-[var(--tag-orange-text)]",
  amber: "border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] text-[var(--tag-amber-text)]",
  teal: "border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] text-[var(--tag-teal-text)]",
  yellow: "border-[var(--tag-yellow-border)] bg-[var(--tag-yellow-bg)] text-[var(--tag-yellow-text)]",
  slate: "border-[var(--tag-slate-border)] bg-[var(--tag-slate-bg)] text-[var(--tag-slate-text)]",
  indigo: "border-[var(--tag-indigo-border)] bg-[var(--tag-indigo-bg)] text-[var(--tag-indigo-text)]",
  plum: "border-[var(--tag-plum-border)] bg-[var(--tag-plum-bg)] text-[var(--tag-plum-text)]",
  neutral: "border-[var(--tag-neutral-border)] bg-[var(--tag-neutral-bg)] text-[var(--tag-neutral-text)]",
};

export const TIER_TONE: Record<DealTier, TagTone> = {
  active: "teal",
  pipeline: "amber",
  passed: "slate",
};

export const STAGE_TONE: Record<DealStage, TagTone> = {
  "Screening/Pipeline": "moss",
  "NBIO / Term Sheet": "purple",
  "Due Diligence": "indigo",
  "SPA / Signing": "orange",
  Completed: "green",
  Passed: "slate",
};

export const PROPRIETARY_TONE: TagTone = "plum";
export const PASSED_TONE: TagTone = "slate";
export const COUNTRY_TONE: TagTone = "neutral";

const INDUSTRY_CLASS: Record<Industry, string> = Object.fromEntries(
  INDUSTRIES.map((industry) => [industry, `ind-${industrySlug(industry)}`]),
) as Record<Industry, string>;

export function industryClass(industry: string | null | undefined) {
  if (!industry) return TAG_CLASS.neutral;
  return INDUSTRY_CLASS[industry as Industry] ?? TAG_CLASS.neutral;
}

export function toneForKey(key: string): TagTone {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const pool = TAG_TONES.filter((tone) => tone !== "neutral");
  return pool[hash % pool.length] ?? "neutral";
}

export function statusTones(): TagTone[] {
  return [...new Set([...Object.values(TIER_TONE), ...Object.values(STAGE_TONE), PROPRIETARY_TONE, PASSED_TONE])];
}
