import { PARTNER_ROLE_CONFIG, ROLE_ON_DEAL_LABEL, ROLE_ON_DEAL_TONE, type TagTone } from "@/lib/constants";
import type { PartnerRole, RoleOnDeal } from "@/types/database";

/** First letters of the first two words, skipping punctuation-only tokens such as "&". */
export function partnerInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]!.toUpperCase());
  return letters.join("") || "?";
}

/** Soft tag colours only. Red reads as an error, so avatars skip it. */
const AVATAR_TONES: TagTone[] = ["blue", "purple", "green", "moss", "amber", "teal", "yellow"];

export function avatarTone(name: string): TagTone {
  const key = name.trim() || "?";
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export type PartnerChip = {
  kind: "type" | "role" | "firm";
  key: string;
  label: string;
  tone: TagTone;
};

function sameChipText(a: string, b: string) {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * Type, then role on the deal, then firm. A later chip is dropped when its
 * text is already on the row. Deal cards pass includeRoles false because the
 * role dropdown already shows that label.
 */
export function partnerChips({
  type,
  company,
  roles = [],
  includeRoles = false,
}: {
  type?: PartnerRole | null;
  company?: string | null;
  roles?: RoleOnDeal[] | null;
  includeRoles?: boolean;
}): PartnerChip[] {
  const chips: PartnerChip[] = [];
  const seen: string[] = [];
  const push = (chip: PartnerChip) => {
    const label = chip.label.trim();
    if (!label || seen.some((item) => sameChipText(item, label))) return;
    seen.push(label);
    chips.push({ ...chip, label });
  };

  if (type) {
    const config = PARTNER_ROLE_CONFIG[type];
    push({ kind: "type", key: `type-${type}`, label: config.label, tone: config.tone });
  }
  if (includeRoles) {
    for (const role of uniqueDealRoles(roles ?? [])) {
      push({ kind: "role", key: `role-${role}`, label: ROLE_ON_DEAL_LABEL[role], tone: ROLE_ON_DEAL_TONE[role] });
    }
  }
  const firm = company?.trim();
  if (firm) push({ kind: "firm", key: "firm", label: firm, tone: "neutral" });
  return chips;
}

/** Source and introducer share a label, so a partner is not tagged twice for the same role. */
export function uniqueDealRoles(roles: RoleOnDeal[]): RoleOnDeal[] {
  const seen = new Set<string>();
  const result: RoleOnDeal[] = [];
  for (const role of roles) {
    const label = ROLE_ON_DEAL_LABEL[role];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    result.push(role);
  }
  return result;
}
