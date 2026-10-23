import { MemoryStore, sharedMemoryStore } from "@/lib/mcp/memory-store";
import { SupabaseStore } from "@/lib/mcp/supabase-store";
import { teamDatabase } from "@/lib/mcp/team-db";

export function memoryStoreEnabled() {
  return process.env.MCP_E2E_MEMORY === "1" && !process.env.VERCEL;
}

export async function openStore(actor: string | null) {
  if (memoryStoreEnabled()) {
    const store = sharedMemoryStore();
    store.actor = actor;
    store.source = "claude";
    return store;
  }
  return new SupabaseStore(await teamDatabase(actor));
}

export type AnyStore = MemoryStore | SupabaseStore;
