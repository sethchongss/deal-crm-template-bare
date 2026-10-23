# Setup

Deal CRM Template starts empty: no sample deals, partners or tasks are shipped in the app or the database. You create every deal yourself, or import a spreadsheet.

If you start the app before the database is configured, it shows a setup page at `/setup` with these same steps.

## Quick start (about 5 steps)

1. **Create a free Supabase project** at [supabase.com](https://supabase.com). Any Postgres-compatible Supabase setup works, including self-hosted Supabase.
2. **Copy the URL and anon key.** In the dashboard open Project Settings → API (or Connect). Copy the Project URL and the anon / publishable key. Never use the service-role key in this app.
3. **Create the tables.** Either use the Supabase CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   or open the SQL Editor and run every file in `supabase/migrations/` in filename order.
4. **Create the team login** with the SQL in [section 3](#3-create-the-shared-team-login). It also adds the email to the database allow-list.
5. **Set the environment variables** (section 1) in `.env.local` and on Vercel, then run `npm run dev` or redeploy.

## How access works

The team shares one password. There are no per-person accounts and no emails are sent. The anon key cannot read or write data.

The password the team types is checked on the server against `TEAM_PASSWORD_HASH`, a scrypt hash. The plaintext password is never stored. A match sets an httpOnly cookie for 30 days, signed with `SESSION_SECRET`. The server then signs in to Supabase as the shared team user (the first address in `TEAM_ALLOWED_EMAILS`). Row level security allows only users whose email is in `private.team_emails`. The browser uses the anon key with that user's session.

The scrypt check runs in the Node.js login route. The proxy only checks the signed cookie, using Web Crypto, so it also works on the Edge runtime.

`SUPABASE_TEAM_PASSWORD` is a separate long random value that only the server uses to call Supabase Auth. It must not be the password people type, because the public anon key can reach Auth's password endpoint.

## 1. Environment variables

Set these in `.env.local` for local development (copy `.env.example`), and in Vercel under Project → Settings → Environment Variables for Production and Preview. Do not commit the values.

| Name | How to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
| `TEAM_ALLOWED_EMAILS` | Comma-separated allow-list. The first address is the shared login, e.g. `crm@your-domain.com`. It never receives mail. |
| `TEAM_PASSWORD_HASH` | `TEAM_PASSWORD='the shared password' node scripts/hash-password.mjs` |
| `SESSION_SECRET` | `openssl rand -base64 32`. Changing it signs everyone out. |
| `SUPABASE_TEAM_PASSWORD` | `openssl rand -base64 32`. Hashed into the shared user in section 3. |
| `CRON_SECRET` | `openssl rand -base64 32` |
| `MCP_TOKEN_SECRET` | `openssl rand -base64 32`. Only needed for the optional connector, see [claude-connector.md](claude-connector.md). |
| `NEXT_PUBLIC_APP_NAME` | Optional display name |
| `APP_PUBLIC_HOSTS` | Recommended on Vercel: your public host(s), e.g. `your-app.vercel.app` |

The hash script prints `scrypt:16384:8:1:<saltB64>:<hashB64>`. Colons are used because Next.js expands `$` in `.env` files. Do not set `TEAM_PASSWORD` itself anywhere. Do not add `SUPABASE_SERVICE_ROLE_KEY`.

Vercel Cron calls `GET /api/cron/keepalive` once a day at 03:00 UTC (`vercel.json`) with `Authorization: Bearer <CRON_SECRET>`, which keeps a free Supabase project from pausing. The route fails closed when `CRON_SECRET` is missing.

## 2. Migrations

`supabase/migrations/` is the whole schema, in filename order. `20261003110000_base_schema.sql` creates the core tables on an empty project; the rest add stages, financials, partners, workstreams and the audit log. No migration inserts deals, partners or other sample rows.

`20261003120000_lockdown.sql` replaces any open policies, revokes anon access, limits the `screening-docs` storage bucket to the team, adds `audit_log` and `keepalive()`, and creates the database allow-list:

- `private.team_emails` holds the allowed login emails (lower case). The migration inserts none.
- `private.is_team()` is true only when the signed-in user's email is in `private.team_emails`. Policies call it as `(select private.is_team())`.

The files directly under `supabase/` (outside `migrations/`) are historical. Do not run them. `supabase/local/00_baseline.sql` is only a stand-in for testing migrations against plain Postgres.

## 3. Create the shared team login

Replace the email with the first address in `TEAM_ALLOWED_EMAILS` and the password with the `SUPABASE_TEAM_PASSWORD` value, then run this in the SQL Editor. Do not commit the password. The email is marked confirmed, so Supabase sends no mail and no SMTP is needed.

```sql
do $$
declare
  team_email    text := lower('crm@your-domain.com'); -- first address in TEAM_ALLOWED_EMAILS
  team_password text := 'REPLACE_WITH_SUPABASE_TEAM_PASSWORD';
  team_id       uuid;
begin
  if team_password like 'REPLACE_WITH_%' or length(team_password) < 32 then
    raise exception 'Set team_password to the SUPABASE_TEAM_PASSWORD value (32+ chars) before running';
  end if;
  select id into team_id from auth.users where lower(email) = team_email and is_sso_user = false;
  if team_id is null then
    team_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', team_id, 'authenticated', 'authenticated', team_email, extensions.crypt(team_password, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Deal CRM Template team"}'::jsonb, now(), now(), '', '', '', '', false, false);
  else
    update auth.users set encrypted_password = extensions.crypt(team_password, extensions.gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()), raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb, confirmation_token = '', recovery_token = '', email_change_token_new = '', email_change = '', banned_until = null, deleted_at = null, updated_at = now() where id = team_id;
    delete from auth.sessions where user_id = team_id;
  end if;
  insert into auth.identities (user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (team_id, jsonb_build_object('sub', team_id::text, 'email', team_email, 'email_verified', true), 'email', team_id::text, now(), now(), now())
  on conflict (provider_id, provider) do update set identity_data = excluded.identity_data, updated_at = now();
  -- Database allow-list read by private.is_team().
  insert into private.team_emails (email) values (team_email) on conflict do nothing;
end $$;
```

Re-running it with a new password updates the hash and ends existing Supabase sessions for that user. It refuses the placeholder and any password shorter than 32 characters.

### Changing the allow-list

The app reads `TEAM_ALLOWED_EMAILS`; the database reads `private.team_emails`. Postgres cannot read Vercel env vars, so keep the two in step:

```sql
insert into private.team_emails (email) values ('new-login@your-domain.com') on conflict do nothing;
delete from private.team_emails where email = 'old-login@your-domain.com';
```

If sign-in says the shared account is not ready, the password in the SQL does not match `SUPABASE_TEAM_PASSWORD`, the email is missing from `private.team_emails`, or password sign-in is turned off in Supabase. As optional hardening, turn off public sign-ups under Authentication → Sign In / Providers → Email.

## 4. Deploy on Vercel

Use the "Deploy with Vercel" button in the README, or import the repository in Vercel. Add the variables from section 1, deploy, then open `https://your-app.vercel.app/sign-in`.

Check the cron route: with the secret it returns `{"ok":true}`, without it 401.

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/keepalive
```

The login route allows 8 failed attempts per IP per 15 minutes, per server instance.

## 5. Rollback

Each migration has a matching file in `supabase/rollback/`. `20261003120000_lockdown.sql` there restores open policies, drops `audit_log`, `private.team_emails` and `private.is_team()`. It does not delete `auth.users` or any deal data.

## 6. Local development

```bash
cp .env.example .env.local   # fill in section 1
npm ci
npm run dev                  # http://localhost:3000
```

Without the Supabase values the app opens `/setup` instead of failing.
