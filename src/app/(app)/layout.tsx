import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasTeamAccess } from "@/lib/team-access";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/setup");
  if (!(await hasTeamAccess())) redirect("/sign-in");
  return <AppShell>{children}</AppShell>;
}
