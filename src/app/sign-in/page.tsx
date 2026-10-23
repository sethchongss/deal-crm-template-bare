import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasTeamAccess } from "@/lib/team-access";
import { safeNextPath } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · Deal Pipeline CRM",
};

const ERRORS: Record<string, string> = {
  password: "That password is incorrect.",
  rate: "Too many attempts. Wait 15 minutes and try again.",
  config: "Team sign-in is not configured yet.",
  account: "The password was accepted, but the shared team account is not ready.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/setup");
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  if (await hasTeamAccess()) redirect(nextPath);

  const error = params.error ? ERRORS[params.error] : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Deal Pipeline CRM</h1>
          <p className="text-sm text-muted-foreground">Sign in with the team password.</p>
        </div>
        <form method="post" action="/api/auth/login" className="space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:shadow-focus"
            />
          </div>
          {error && (
            <p className="text-sm text-foreground" role="alert">{error}</p>
          )}
          <button
            type="submit"
            className="press inline-flex h-9 w-full items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
