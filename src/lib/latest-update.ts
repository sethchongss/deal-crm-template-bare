import type { Deal } from "@/types/database";

export type LatestUpdatePatch = Pick<Deal, "latest_update" | "latest_update_at">;

/**
 * A non-empty composer submission is a new note and becomes the stored latest
 * update. Blank text is not a save: the previous latest update stays put.
 */
export function latestUpdateFromNote(content: string, at = new Date()): { content: string; patch: LatestUpdatePatch } | null {
  const text = content.trim();
  if (!text) return null;
  return {
    content: text,
    patch: {
      latest_update: text,
      latest_update_at: at.toISOString(),
    },
  };
}

/**
 * Editing the newest note rewrites the stored latest update so the card and
 * the Claude connector still show that note. Older notes do not.
 */
export function latestUpdateAfterEdit(editedIsNewest: boolean, nextContent: string, stored: string | null): string | null {
  if (!editedIsNewest) return stored;
  return nextContent;
}

/**
 * Deleting the newest note points the stored latest update at the note that
 * is now newest, or clears it when the log is empty. Deleting an older note
 * leaves the stored update alone.
 */
export function latestUpdateAfterDelete(
  deletedIsNewest: boolean,
  newestRemaining: { content: string; created_at: string } | null,
): LatestUpdatePatch | null {
  if (!deletedIsNewest) return null;
  if (!newestRemaining) return { latest_update: null, latest_update_at: null };
  return {
    latest_update: newestRemaining.content,
    latest_update_at: newestRemaining.created_at,
  };
}
