import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isTeamEmailClaim, SESSION_COOKIE, verifySession } from "@/lib/session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

function applySupabaseResponse(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
  return to;
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/sign-in" ||
    pathname === "/setup" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/cron/keepalive" ||
    pathname === "/api/mcp" ||
    pathname === "/api/oauth/register" ||
    pathname === "/api/oauth/token" ||
    pathname === "/api/oauth/authorize" ||
    pathname.startsWith("/.well-known/")
  );
}

export async function updateSession(request: NextRequest) {
  // First run: without Supabase settings, show the setup guide instead of erroring.
  if (!isSupabaseConfigured()) {
    const { pathname } = request.nextUrl;
    if (pathname === "/setup") return NextResponse.next({ request });
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Database not configured. Open /setup." }, { status: 503 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });
  const secure = request.nextUrl.protocol === "https:";

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, {
            ...options,
            secure,
            sameSite: "lax",
            path: "/",
          });
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  // Refresh the shared Supabase session before any other logic.
  const { data } = await supabase.auth.getClaims();
  const { pathname } = request.nextUrl;
  const teamCookie = await verifySession(sessionToken, process.env.SESSION_SECRET || "");
  const teamUser = isTeamEmailClaim(data?.claims?.email);
  const allowed = teamCookie && teamUser;

  if (allowed || isPublicPath(pathname)) {
    return supabaseResponse;
  }

  if (pathname.startsWith("/api/")) {
    return applySupabaseResponse(
      supabaseResponse,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return applySupabaseResponse(supabaseResponse, NextResponse.redirect(url));
}
