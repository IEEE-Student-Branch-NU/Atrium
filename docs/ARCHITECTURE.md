# Atrium — Architecture Overview

> The 10,000-foot view: what the pieces are, how a request flows, and where everything lives. Start here, then drill into [AUTH.md](AUTH.md), [SCHEMA.md](SCHEMA.md), [PERMISSIONS.md](PERMISSIONS.md), and the [feature docs](features/).
> **Last Updated:** July 2026

---

## What Atrium is

An internal portal for the **IEEE Student Branch of Nirma University (SBNU)**. It manages **members** (registration, approval, positions), a **branch hierarchy** (SBNU + sub-branches CS/ITSS/WIE/SIGHT/SPS), **permissions**, **notifications**, and a **super-admin console**. (An Events module is modelled in the DB but [not yet built](features/events.md).)

## Stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 16.2** (App Router, RSC, Turbopack), React 19 |
| Auth | **NextAuth / Auth.js v5** (JWT sessions) — *not* Supabase Auth |
| Database | **Supabase Postgres**, accessed via the **service-role admin client** (RLS bypassed) |
| Realtime | Supabase Realtime (websocket) — the *only* RLS-subject path |
| Styling/UI | Tailwind v4, shadcn / Base-UI primitives, `lucide-react`, `sonner` toasts, `recharts` |
| Passwords | `bcrypt` (Node runtime only) |
| Tokens/crypto | `jose` (Supabase realtime JWT, impersonation cookie) |
| Email | Resend via plain `fetch` (optional; graceful no-op) |
| Tests | Vitest (node env, pure-function unit tests) |

> **Read `node_modules/next/dist/docs/` before writing Next.js code.** Per `AGENTS.md`, this is Next.js 16 with breaking changes vs. earlier versions — don't assume older App Router behavior.

## The one big idea: NextAuth owns identity, Supabase is "just Postgres"

- All DB access is server-side through `createAdminClient()` (service-role key) which **bypasses RLS**. Authorization is enforced **in application code** (the [permission engine](PERMISSIONS.md)), not by the database.
- **RLS matters in exactly one place:** the browser Realtime subscription. The server mints a short-lived Supabase JWT (`sub` = profile id) so `auth.uid()` works for the `notifications` RLS policy. Nothing else relies on RLS.
- Only three tables have RLS enabled: `superadmins` and `audit_log` (no policies → service-role only) and `notifications` (one SELECT policy for the realtime path).

## Request lifecycle

```
Browser request
   │
   ▼
Edge Middleware (src/middleware.ts → utils/supabase/middleware.ts)   [Edge — no bcrypt]
   • reads NextAuth JWT (session.isSuperAdmin, etc.)
   • public / auth-only / protected routing
   • status gate: no IEEE ID → /complete-registration; pending → /pending; rejected → /rejected
   • super-admin → /superadmin ; impersonation detected by cookie presence
   │
   ▼
Server Component (page.tsx / layout.tsx)                              [Node]
   • auth() / getEffectiveActor()  → who am I (and am I impersonating?)
   • resolve active workspace (cookie) → getUserProfileWithMembership
   • getUserPermissions(...)        → what can I do here
   • fetch data via lib/queries.ts / superadmin/queries.ts (admin client)
   • render → hand data to a 'use client' component
   │
   ▼
Client Component                                                     [Browser]
   • interactions call Server Actions ('use server')
   • Realtime provider subscribes to notifications (minted JWT)
   │
   ▼
Server Action (actions.ts)                                           [Node]
   • re-check auth + permission (the REAL boundary)
   • mutate via admin client
   • side effects: notify*(), logAdminAction(), audit rows  (best-effort)
   • revalidatePath(...)
```

## Edge vs Node split (load-bearing)

`bcrypt` and the `server-only` auth utilities **cannot** run at the Edge. So the code is split:
- **Edge-safe** (`auth.config.ts`, `middleware.ts`) — Google provider + JWT/session callbacks + routing. Reads super-admin status from the **JWT flag** only.
- **Node-only** (`auth.ts`, `utils/auth/*`) — Credentials provider (bcrypt), `isSuperAdmin()` (bcrypt vs `superadmins`), impersonation crypto.

Never import bcrypt or a `server-only` module into anything the middleware pulls in. See [AUTH.md](AUTH.md).

## Directory map

```
src/
├── app/
│   ├── (portal)/                 ← member portal (route group, shared layout)
│   │   ├── layout.tsx            ← shell: actor, workspace, permissions, realtime
│   │   ├── page.tsx              ← dashboard home
│   │   ├── approvals/            ← registration review        [features/registrations-approvals.md]
│   │   ├── pre-approved/         ← IEEE-ID whitelist
│   │   ├── position-requests/    ← promotion review           [features/position-requests.md]
│   │   ├── members/ , profile/   ← directory + About Me       [features/members.md]
│   │   ├── analytics/            ← charts                     [features/portal-dashboard.md]
│   │   ├── notifications/        ← in-app list + Chair tab    [features/notifications.md]
│   │   └── actions.ts            ← switchWorkspace
│   ├── superadmin/               ← super-admin console        [features/superadmin-portal.md]
│   │   ├── login/                ← fixed username/password
│   │   └── (dashboard)/          ← gated console pages
│   ├── auth/actions.ts           ← signUp/signIn/completeRegistration/signOut
│   ├── login, signup, pending, rejected, complete-registration
│   └── api/{auth,positions}/     ← NextAuth handler + positions endpoint
├── lib/
│   ├── queries.ts                ← portal read layer
│   ├── notifications/            ← the notification service  [features/notifications.md]
│   └── utils.ts                  ← cn() etc.
├── components/{portal,superadmin,providers,ui}/
├── utils/
│   ├── auth/                     ← permissions, superadmin, impersonation, effective-actor, workspace, audit
│   ├── supabase/                 ← server (admin) + client (browser) + token + middleware
│   └── search.ts                 ← PostgREST .or() sanitizer
├── auth.ts / auth.config.ts      ← NextAuth (Node / Edge)
├── middleware.ts
└── test/empty.ts                 ← server-only shim for vitest
supabase/migrations/              ← 00001 … 00011 (applied MANUALLY in Supabase)
docs/                             ← you are here
```

## Cross-cutting patterns (see [ENGINEERING.md](ENGINEERING.md) for detail)

- **Server Actions** return `{ success } | { error }` (or throw, or redirect — three coexisting conventions).
- **Append-only history** — `memberships` and `member_permissions` are never updated in place (active = `ended_at`/`revoked_at IS NULL`).
- **Best-effort side effects** — notifications, email, and audit writes never throw into the calling action.
- **Migrations are applied by hand** in the Supabase dashboard; code degrades gracefully when a migration isn't applied yet.
- **Permissions are workspace-scoped** and never merged across branches.

## Where to go next

- New here? → [DEVELOPMENT.md](DEVELOPMENT.md) to run it, then [ENGINEERING.md](ENGINEERING.md) for conventions.
- Touching auth/roles? → [AUTH.md](AUTH.md) + [PERMISSIONS.md](PERMISSIONS.md).
- Touching data? → [SCHEMA.md](SCHEMA.md).
- A specific screen? → the matching file in [features/](features/).
