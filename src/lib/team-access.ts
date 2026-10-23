import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTeamEmailClaim, SESSION_COOKIE, verifySession } from "@/lib/session";

export async function hasTeamAccess() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  const jar = await cookies();
  if (!(await verifySession(jar.get(SESSION_COOKIE)?.value, secret))) return false;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return isTeamEmailClaim(data?.claims?.email);
}

export async function requireTeamApi() {
  if (await hasTeamAccess()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
