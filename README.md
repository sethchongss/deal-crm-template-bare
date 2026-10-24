# PE/VC/Family Office bespoke CRM (Free)

**Deal CRM Template** is a free, self-hosted deal pipeline for private equity, venture capital and family office teams. It runs on Next.js and Supabase and deploys to Vercel's free tier.

The app ships empty: no sample deals or seed data. You create deals from scratch or import a spreadsheet.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fszesiangchong%2Fdeal-crm-template-bare&project-name=deal-crm&env=NEXT_PUBLIC_SUPABASE_URL%2CNEXT_PUBLIC_SUPABASE_ANON_KEY%2CTEAM_ALLOWED_EMAILS%2CTEAM_PASSWORD_HASH%2CSESSION_SECRET%2CSUPABASE_TEAM_PASSWORD%2CCRON_SECRET%2CMCP_TOKEN_SECRET&envDescription=Supabase+URL+and+anon+key%2C+team+allow-list+and+secrets.+See+docs%2FSETUP.md.&envLink=https%3A%2F%2Fgithub.com%2Fszesiangchong%2Fdeal-crm-template-bare%2Fblob%2Fmain%2Fdocs%2FSETUP.md)

The button asks for the Supabase URL and anon key plus the secrets listed below. Any Postgres-compatible Supabase setup works (Supabase Cloud free plan or self-hosted).

## Features

- A three-column board: **Active | Pipeline | Passed / Out**, with soft pastel cards in a colour per column, large status chips and a checklist progress bar on every card, plus archive and realized views
- Deal pages with an investment checklist (Screening, First call, NDA, Model, Due diligence, IC, Close), financials, notes, workstreams and a Gantt timeline
- Partners directory (advisers, co-investors, lenders, operators) linked to deals
- Spreadsheet import and Excel export
- Optional MCP connector so any MCP client can read and update deals, with an audit log and undo
- Shared team password with a configurable email allow-list, enforced by Postgres row level security

## Stack

Node.js 22.6+ (tests use built-in type stripping), Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres + Auth), Vercel.

## Quick start

1. **Create a free Supabase project** at [supabase.com](https://supabase.com) and copy the Project URL and anon (publishable) key from Project Settings → API.
2. **Create the tables:** `npx supabase link --project-ref <ref> && npx supabase db push`, or paste each file in `supabase/migrations/` into the SQL Editor in filename order.
3. **Create the team login** with the SQL in [`docs/SETUP.md`](docs/SETUP.md#3-create-the-shared-team-login). It adds the login email to `private.team_emails`, the database allow-list.
4. **Set the environment variables** (table below) in `.env.local`, and in Vercel for Production and Preview.
5. **Run it:** `npm ci && npm run dev` (http://localhost:3000), or use the Deploy button. Sign in and click **Create your first deal**.

Until the Supabase URL and key are set, the app shows a setup page at `/setup` instead of an error. Full details are in [`docs/SETUP.md`](docs/SETUP.md).

### Customising

- **Team allow-list.** `TEAM_ALLOWED_EMAILS` (app) and `private.team_emails` (database) must list the same login emails. Postgres cannot read Vercel env vars, so the setup SQL keeps them in step.
- **Branding.** Set `NEXT_PUBLIC_APP_NAME`. Replace `src/components/brand-mark.tsx` and `public/brand-mark.svg` with your logo.
- **Team members.** Edit the placeholder names in `src/lib/team.ts` and `src/lib/mcp/team.ts`. Connector names must match the actor list in `supabase/migrations/20261003160000_audit_source.sql`.
- **Connector (optional).** See [`docs/claude-connector.md`](docs/claude-connector.md).

## Environment variables

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `TEAM_ALLOWED_EMAILS` | Comma-separated allow-list; first entry is the shared login. Mirror it in `private.team_emails`. |
| `TEAM_PASSWORD_HASH` | scrypt hash of the shared team password |
| `SESSION_SECRET` | Signs the session cookie |
| `SUPABASE_TEAM_PASSWORD` | Password of the shared Supabase user (not the typed password) |
| `CRON_SECRET` | Protects the keepalive cron |
| `MCP_TOKEN_SECRET` | Signs connector OAuth tokens |
| `NEXT_PUBLIC_APP_NAME` | Optional display name |
| `APP_PUBLIC_HOSTS` | Public hosts for OAuth/MCP metadata |

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # unit and integration tests (node:test)
```

## Backups

The Supabase free plan has no automatic backups. Use the in-app export, take manual database dumps, or use a paid plan.

## License

Provided as a free template. Add the license of your choice before redistributing.

## Workflows

The MCP server ships prompts for filing a new deal from a teaser, updating deals from new information, and a preliminary screen. See [docs/workflows](docs/workflows/README.md) for setup.
