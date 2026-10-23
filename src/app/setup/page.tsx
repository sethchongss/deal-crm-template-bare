import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { APP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Set up the database · ${APP_NAME}`,
};

const ENV_LOCAL = `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
TEAM_ALLOWED_EMAILS=crm@your-domain.com
TEAM_PASSWORD_HASH=<from scripts/hash-password.mjs>
SESSION_SECRET=<openssl rand -base64 32>
SUPABASE_TEAM_PASSWORD=<openssl rand -base64 32>
CRON_SECRET=<openssl rand -base64 32>
MCP_TOKEN_SECRET=<openssl rand -base64 32>`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">{n}</span>
        <div className="min-w-0 space-y-2 text-sm leading-6">
          <h2 className="text-base font-semibold">{title}</h2>
          {children}
        </div>
      </div>
    </li>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-5">{children}</pre>;
}

export default function SetupPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">First-run setup</p>
        <h1 className="text-2xl font-bold">Connect {APP_NAME} to a database</h1>
        {configured ? (
          <p className="text-sm text-muted-foreground">
            Supabase settings were found. If you have run the migrations and created the team login, <Link href="/sign-in" className="underline">sign in</Link>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            The app needs a Supabase (Postgres) database before it can store deals. This takes about five minutes on the free plan. Nothing is pre-loaded: you start with an empty pipeline.
          </p>
        )}
      </header>

      <ol className="space-y-4">
        <Step n={1} title="Create a free Supabase project">
          <p>
            Sign up at{" "}
            <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline">supabase.com</a>{" "}
            and create a new project. The free plan is enough. Any Postgres-compatible Supabase setup works, including self-hosted Supabase.
          </p>
        </Step>
        <Step n={2} title="Copy the URL and anon key">
          <p>
            In the Supabase dashboard open <strong>Project Settings → API</strong> (or <strong>Connect</strong>). Copy the <strong>Project URL</strong> and the <strong>anon / publishable</strong> key. Never use the service-role key in this app.
          </p>
        </Step>
        <Step n={3} title="Create the tables">
          <p>With the Supabase CLI, from the repository folder:</p>
          <Code>{`npx supabase login\nnpx supabase link --project-ref <project-ref>\nnpx supabase db push`}</Code>
          <p>
            Or open the <strong>SQL Editor</strong> in the dashboard and run each file in <code>supabase/migrations/</code> in filename order.
          </p>
        </Step>
        <Step n={4} title="Create the team login">
          <p>
            Run the SQL in section 3 of <code>docs/SETUP.md</code>. It creates the shared Supabase user and adds its email to <code>private.team_emails</code>, the database allow-list. Use the same email as the first entry of <code>TEAM_ALLOWED_EMAILS</code>.
          </p>
        </Step>
        <Step n={5} title="Set the environment variables">
          <p>Locally, copy <code>.env.example</code> to <code>.env.local</code>, fill it in, and restart <code>npm run dev</code>:</p>
          <Code>{ENV_LOCAL}</Code>
          <p>
            Generate the password hash with <code>TEAM_PASSWORD=&apos;your password&apos; node scripts/hash-password.mjs</code>.
            On Vercel, add the same variables under <strong>Project → Settings → Environment Variables</strong> for Production and Preview, then redeploy.
          </p>
        </Step>
      </ol>

      <p className="mt-8 text-xs text-muted-foreground">Full guide: <code>docs/SETUP.md</code> in the repository.</p>
    </main>
  );
}
