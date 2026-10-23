import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEAM_EMAIL } from "@/lib/session";
import { CrmError } from "@/lib/mcp/deal-write";

type Session = { access_token: string; refresh_token: string; expires_at: number };

let cached: Session | null = null;
let pending: Promise<Session> | null = null;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new CrmError(`${name} is not set, so the connector cannot reach the database.`);
  return value;
}

async function signIn(): Promise<Session> {
  const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEAM_EMAIL,
    password: required("SUPABASE_TEAM_PASSWORD"),
  });
  if (error || !data.session) throw new CrmError("The shared team database account could not sign in.");
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 300,
  };
}

async function teamSession() {
  if (cached && cached.expires_at * 1000 > Date.now() + 60_000) return cached;
  if (!pending) {
    pending = signIn().finally(() => {
      pending = null;
    });
  }
  cached = await pending;
  return cached;
}

export async function teamDatabase(actor: string | null): Promise<SupabaseClient> {
  const session = await teamSession();
  const headers: Record<string, string> = { "x-crm-source": "claude" };
  if (actor) headers["x-crm-actor"] = actor;
  const client = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers },
  });
  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw new CrmError("The shared team database session could not be reused.");
  return client;
}

export function resetTeamSession() {
  cached = null;
}
