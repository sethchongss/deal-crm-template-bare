import { NextRequest, NextResponse } from "next/server";
import { clientIp, isLoginLimited, recordLoginFailure } from "@/lib/login-rate-limit";
import {
  requestIsSecure,
  safeNextPath,
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  TEAM_EMAIL,
} from "@/lib/session";
import { verifyTeamPassword } from "@/lib/team-password";
import { createRouteClient } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(request: NextRequest, code: string, nextPath: string) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", code);
  if (nextPath !== "/") url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const nextPath = safeNextPath(String(form.get("next") ?? ""));
  const ip = clientIp(request);

  if (isLoginLimited(ip)) {
    return fail(request, "rate", nextPath);
  }

  if (password.length === 0 || password.length > 1024) {
    recordLoginFailure(ip);
    return fail(request, "password", nextPath);
  }

  const passwordHash = process.env.TEAM_PASSWORD_HASH;
  const sessionSecret = process.env.SESSION_SECRET;
  const supabasePassword = process.env.SUPABASE_TEAM_PASSWORD;
  if (!passwordHash || !sessionSecret || !supabasePassword) {
    return fail(request, "config", nextPath);
  }

  if (!verifyTeamPassword(password, passwordHash)) {
    recordLoginFailure(ip);
    return fail(request, "password", nextPath);
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  const supabase = createRouteClient(request, response);
  const { error } = await supabase.auth.signInWithPassword({
    email: TEAM_EMAIL,
    password: supabasePassword,
  });

  if (error) {
    console.error("shared team sign-in failed", error.message);
    return fail(request, "account", nextPath);
  }

  response.cookies.set(
    SESSION_COOKIE,
    await signSession(sessionSecret),
    sessionCookieOptions(requestIsSecure(request)),
  );
  return response;
}
