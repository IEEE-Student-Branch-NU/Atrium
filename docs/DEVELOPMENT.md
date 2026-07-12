# Atrium — Development Guide

> Get it running, know every env var, apply migrations, and verify changes. Setup steps also live in the root [README.md](../README.md); this is the canonical, complete reference.
> **Last Updated:** July 2026

---

## Prerequisites

- Node.js (LTS) + npm
- A Supabase project (Postgres) — the app uses it as a database only
- A Google Cloud OAuth client (for Google sign-in) restricted to `nirmauni.ac.in`
- *(optional)* a Resend account for outbound email

## Quick start

```bash
npm install
# create .env / .env.local  (see env vars below)
# apply all migrations in the Supabase SQL editor, in order (see below)
npm run dev            # http://localhost:3000
```

## Scripts

| Script | Does |
|--------|------|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` | Production build **+ TypeScript check** (main verification gate) |
| `npm start` | Serve the production build |
| `npm test` | Vitest run (unit tests) |
| `npm run test:watch` | Vitest watch |
| `npm run lint` | ESLint (not the primary gate here) |

## Environment variables (complete)

`.env*` is gitignored (`.env*`), so nothing here is committed. Set the same vars in your deploy environment (Vercel → Settings → Environment Variables).

| Variable | Required | Used by | Purpose |
|----------|:--------:|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | server + browser clients | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | `createAdminClient()` | Server-side DB access (bypasses RLS). **Never expose to the browser.** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | browser Realtime client | Anon key for the websocket client |
| `SUPABASE_JWT_SECRET` | ✅ (for realtime) | `createSupabaseToken` | Signs the browser JWT (`sub`=profileId) so `auth.uid()` works for notification RLS |
| `AUTH_SECRET` | ✅ | NextAuth + impersonation cookie | Signs JWT sessions and the `atrium_impersonate` cookie |
| `NEXTAUTH_URL` | ✅ | NextAuth | Canonical app URL for callbacks |
| `NEXT_PUBLIC_APP_URL` | ✅ | email templates | Absolute URLs in notification emails |
| `AUTH_GOOGLE_ID` | ✅ | Google provider | OAuth client id |
| `AUTH_GOOGLE_SECRET` | ✅ | Google provider | OAuth client secret |
| `BCRYPT_SALT_ROUNDS` | — (default 12) | signup / password change | bcrypt cost |
| `SUPERADMIN_USERNAME` | ✅ (for `/superadmin/login`) | `src/auth.ts` | Fixed super-admin username. Login is **inert** if unset. |
| `SUPERADMIN_PASSWORD` | ✅ (for `/superadmin/login`) | `src/auth.ts` | Fixed super-admin password |
| `RESEND_API_KEY` | optional | `email.ts` | Enables notification email; **no-op if unset** |
| `EMAIL_FROM` | optional | `email.ts` | `Atrium <no-reply@your-verified-domain>` |

> Google OAuth: add `http://localhost:3000` to Authorized JavaScript Origins and `http://localhost:3000/api/auth/callback/google` to Authorized Redirect URIs. See [AUTH.md](AUTH.md).

## Database migrations (⚠️ applied manually)

There is **no automated migration runner**. Open the Supabase SQL editor and run each file in `supabase/migrations/` **in order**, once:

`00001` schema → `00002` permissions → `00003` NextAuth decouple → `00004` invisible super-admins → `00005` positions → `00006` requests + notifications → `00007` notification types → `00008` audit_log → `00009` broadcast + realtime → `00010` fixed super-admin profile → `00011` notification routing.

Notes:
- Pages that read `00008`/`00011` columns (super-admin **Audit** and **Notifications**) **degrade to empty** if those aren't applied yet — apply them to light up those features.
- `00004` seeds four super-admins with a **default shared passphrase** (`ieee_sudo_2026` in the file). Rotate `superadmins.passphrase_hash` for any real deployment, and set your own `SUPERADMIN_USERNAME/PASSWORD`. See [AUTH.md](AUTH.md).
- After DB changes, keep [SCHEMA.md](SCHEMA.md) §10 and the README migration list in sync.

## Super-admin access locally

Two ways in (both surface as `session.isSuperAdmin`):
1. **Fixed login** — go to `/superadmin/login`, use `SUPERADMIN_USERNAME`/`SUPERADMIN_PASSWORD`.
2. **Invisible identity** — sign in normally with an `@nirmauni.ac.in` email whose bcrypt hash is a row in `superadmins` (seeded in `00004`), **via `/superadmin/login`** (the flag is only set on that form).

## Verifying a change

The repo's gate is **build + test** (not lint):

```bash
npm run build     # compiles + typechecks — must be clean
npm test          # vitest — must pass
```

For runtime behavior that depends on the DB, also **apply the relevant migration in Supabase** and smoke-test the flow (the build/tests can't exercise the live database). See the verification notes in each [feature doc](features/).

## Common tasks

| Task | Where |
|------|-------|
| Add a portal page | [ENGINEERING.md](ENGINEERING.md) §"Adding a feature" |
| Add a permission | [PERMISSIONS.md](PERMISSIONS.md) §6 |
| Add a notification trigger | [features/notifications.md](features/notifications.md) §"How to extend" |
| Turn on email | set `RESEND_API_KEY` + `EMAIL_FROM` (verified domain) |
| Build the Events feature | [features/events.md](features/events.md) §"How to build it" |
| Add a shadcn primitive | `npx shadcn@latest add <name>` (config in `components.json`) |

## Gotchas for new contributors

- **`graphify-out/` doesn't exist** in the checkout despite `AGENTS.md`/`CLAUDE.md` referencing it — `graphify query` won't work here.
- **Next.js 16 has breaking changes** — read `node_modules/next/dist/docs/` before assuming App Router behavior. `params`/`searchParams` are Promises (await them).
- `.env*` is fully gitignored — there's no committed `.env.example`; this table is the source of truth.
