/** Team members. Placeholders: replace with your team. Extend this list to add someone to every assignee picker. */
export const SINGAPORE_TEAM = [
  { name: "Member 1", initials: "M1", email: "member1@example.com", color: "#1D4ED8" },
  { name: "Member 2", initials: "M2", email: "member2@example.com", color: "#0F766E" },
  { name: "Member 3", initials: "M3", email: "member3@example.com", color: "#C2410C" },
] as const;

export type TeamMember = (typeof SINGAPORE_TEAM)[number];

function compact(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match a stored owner to a team member by name, email, initials, or a unique first name. */
export function teamMemberFor(owner: string | null | undefined): TeamMember | null {
  const key = owner ? compact(owner) : "";
  if (!key) return null;
  const exact = SINGAPORE_TEAM.find((member) => compact(member.name) === key || member.email.toLowerCase() === key || member.initials.toLowerCase() === key);
  if (exact) return exact;
  const byFirst = SINGAPORE_TEAM.filter((member) => member.name.split(" ")[0]?.toLowerCase() === key);
  return byFirst.length === 1 ? byFirst[0] : null;
}

/** Full name when the value is a team member, otherwise the trimmed text, or null when empty. */
export function assigneeLabel(owner: string | null | undefined): string | null {
  const member = teamMemberFor(owner);
  if (member) return member.name;
  const text = owner?.trim();
  return text || null;
}

export function assigneeInitials(owner: string | null | undefined): string {
  const member = teamMemberFor(owner);
  if (member) return member.initials;
  const parts = (owner ?? "")
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
}
