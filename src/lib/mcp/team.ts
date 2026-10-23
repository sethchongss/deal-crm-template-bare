/** Placeholder actor labels. Keep in sync with the actor list in supabase/migrations/20261003160000_audit_source.sql. */
export const TEAM_MEMBERS = ["Member 1", "Member 2", "Member 3"] as const;

export type TeamMember = (typeof TEAM_MEMBERS)[number];

export function canonicalActor(value: string | null | undefined): TeamMember | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return TEAM_MEMBERS.find((name) => name.toLowerCase() === trimmed.toLowerCase()) ?? null;
}
