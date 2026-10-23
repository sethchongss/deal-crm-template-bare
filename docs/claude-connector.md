# Claude connector

The CRM exposes a remote MCP server so Claude Team can search and update deals. The owner adds the connector once. Each member then connects and enters the shared team password.

The connector URL is your deploy's public host plus `/api/mcp`, for example `https://your-app.vercel.app/api/mcp`.

Allowed hosts are localhost, the deploy's own hosts from Vercel's system variables (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_BRANCH_URL`, `VERCEL_URL`), and any hosts listed in `APP_PUBLIC_HOSTS` (comma-separated, for example `your-app.vercel.app,crm.your-domain.com`). Preview hosts of a listed `*.vercel.app` project are allowed too. See `src/lib/mcp/hosts.ts`.

OAuth metadata is derived from the host of the request. A token issued for one host is not valid on another. Pick one URL and stay with it.

## Before anyone connects

1. Set `MCP_TOKEN_SECRET` on Vercel for Production, Preview, and Development. Generate it with `openssl rand -base64 32`. Do not commit the value. Authorization fails closed until this is set.
2. Apply `supabase/migrations/20261003160000_audit_source.sql` in the Supabase SQL editor. It only adds `source` and `actor_label` on `audit_log`, replaces the audit trigger so Claude writes are tagged, and adds `undo_claude_change`. It does not change deal rows. Rollback is `supabase/rollback/20261003160000_audit_source.sql`. Read-only checks are in `supabase/verification/audit_source_checks.sql`.
3. The connector still answers before that migration. Search, create, and update work. "via Claude" badges and undo return a clear error until the migration is applied.

Do not set a service-role key. The connector signs in as the shared team user (the first address in `TEAM_ALLOWED_EMAILS`, see [SETUP.md](SETUP.md)), the same way the website does.

## Add it in Claude Team

Wording below follows Anthropic's custom-connector help (support article 11175166).

An Owner or Primary Owner:

1. Open **Organization settings**, then **Connectors**.
2. Choose **Add**. Hover **Custom** and select **Web**.
3. Enter a name (for example "Deal CRM Template") and the remote MCP URL above. Continue.
4. Review the detected authentication. Continue.
5. Authentication: **Sign in now** or **Sign in when needed**. Do not choose **No sign in**.
6. OAuth client: **Use Claude’s published identity (Recommended)** or **Register automatically**. Both work. Leave request headers empty.
7. Add the connector.

Each member then opens **Customize**, then **Connectors**, and connects individually. Claude asks for the shared team password. The name picker (the names in `TEAM_MEMBERS` in `src/lib/mcp/team.ts`, which must match the actor list in the audit migrations) is optional. A chosen name is stored on the audit row so the change can be undone.

Custom connectors run from Anthropic's cloud, so the URL must be the public Vercel host, not localhost.

## What Claude can do

Search and open deals, create a screened deal, update fields, mark or unmark passed, archive, add notes, manage workstreams and tasks, list and create partners, link or unlink a partner, list recent Claude changes, and undo one of those changes. There is no delete-deal tool. Archive is the way to take a deal off the board. Undo of a create deletes that new row. `add_deal_note` and `update_deal` with `latest_update` both log a note and store that text as the deal's latest update. An empty latest update is rejected, so the previous one stays.

Passing a deal moves it to Passed / Out and keeps its stage. Un-passing restores the previous active board, or Pipeline.

Every connector write is tagged "via Claude". The board, table, and deal page show a badge and an Undo button for recent tagged changes. Undo restores the previous values, or deletes a row Claude inserted.

## Example prompts

- Add this teaser as a new deal in the CRM.
- Update deal-1 next steps: SPA signed today.
- Mark deal-2 as passed: valuation gap.

## Limits

- Access tokens last one hour. Refresh tokens last 30 days. Refresh tokens are not revoked early; a new one is issued on refresh and the previous one stays valid until it expires.
- Authorization codes are single-use on the instance that issued them. A replay on another instance within five minutes can still succeed. Codes expire after five minutes.
- Consent attempts are limited to 8 failures per 15 minutes per IP. Tool calls are limited to 120 per minute per access token.
- Redirects are limited to `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`, and `http://localhost` or `http://127.0.0.1` paths of `/callback` (any port, for Claude Code).
