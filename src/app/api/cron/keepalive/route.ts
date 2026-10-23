import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;

  const token = header.slice("Bearer ".length);
  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("keepalive missing Supabase env");
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.rpc("keepalive");

  if (error) {
    console.error("keepalive failed", error.message);
    const missing = error.message.toLowerCase().includes("keepalive")
      || error.message.toLowerCase().includes("schema cache")
      || error.message.toLowerCase().includes("does not exist");
    return NextResponse.json(
      { error: missing ? "Keepalive function is not installed yet" : "Keepalive query failed" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
