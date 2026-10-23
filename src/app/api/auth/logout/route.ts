import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { createRouteClient } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/sign-in", request.url), 303);
  const supabase = createRouteClient(request, response);
  await supabase.auth.signOut({ scope: "local" });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
