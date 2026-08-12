@AGENTS.md

# Atrium — AI Assistant Guide

Atrium is the operations system for **IEEE Nirma University Student Branch (SB NU)**:
member registration & approval, workspace/role switching, events, position requests,
notifications, and audit — plus an invisible **super-admin console**. This file is the
map. The deep docs live in `docs/`; read them before touching a subsystem.

> **This is NOT the Next.js you know.** Version `16.2.10` has breaking changes vs. your
> training data — the middleware file is `src/proxy.ts` (not `middleware.ts`), config
> keys differ, etc. Before writing framework code, read the relevant guide in
> `node_modules/next/dist/docs/01-app/`. Heed deprecation notices.

---

## 1. Stack at a glance

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 App Router, React 19.2, RSC-first | Middleware entry = `src/proxy.ts` |
| Auth | NextAuth (Auth.js) v5, **JWT strategy** | Google (`@nirmauni.ac.in`) + Credentials (bcrypt) |
| Data | Supabase Postgres via `@supabase/supabase-js` (PostgREST) | **Service-role admin client, RLS bypassed in app** |
| UI | Base-UI primitives (shadcn-style) + Tailwind v4 | Triggers use `render={<C/>}`, not `asChild` |
| Charts | Recharts | Analytics pages |
| Images | ImageKit (upload/transform CDN) + `sharp` | |
| Tests | Vitest (`environment: 'node'`) | Pure-function unit tests |

There are **two portals**, both served from this one app:

1. **Member portal** — `src/app/(portal)/**`, root `/`. Gated by registration status
   (`approved` only) and workspace-scoped permissions.
2. **Super-admin console** — `src/app/superadmin/**`. A super admin controls everything
   (permission wildcard `*`), can **impersonate** a member's workspace, and is routed
   here automatically by the proxy. Super-admin status is a bcrypt-verified flag stamped
   onto the JWT **once at sign-in** and read at the Edge as `session.isSuperAdmin`.

---

## 2. Where things live

```
src/
  proxy.ts                      # Edge middleware entry → authMiddleware()
  auth.ts / auth.config.ts      # NextAuth (Node) / Edge-safe base config
  app/
    (portal)/                   # Member portal (layout gates + fans out reads)
    superadmin/(dashboard)/     # Super-admin console
    api/                        # auth, public/events, cron, imagekit, positions, gallery
  lib/
    queries.ts                  # Portal read queries (centralized)
    notifications/              # Notification catalog + best-effort delivery
    images/                     # ImageKit + sharp processor
  utils/
    supabase/{server,client,middleware,token}.ts
    auth/{superadmin,effective-actor,permissions,impersonation,workspace,audit}.ts
    search.ts                   # sanitizeSearchTerm — MUST wrap any .or(...ilike...) term
  app/superadmin/queries.ts     # Console read queries
supabase/migrations/            # Hand-applied SQL (no runner) — see §6
docs/                           # ARCHITECTURE, AUTH, PERMISSIONS, SCHEMA, ENGINEERING, features/
```

Read `docs/ENGINEERING.md` first — it is the "how we build here" doc (data-access rules,
Server-Action conventions, best-effort side effects, append-only history, the sharp edges).

---

## 3. Core conventions (the short version)

- **Server reads → `createAdminClient()`.** Never import it or the service-role key into
  client code. The browser client is Realtime-only.
- **No ORM.** Inline supabase-js query builder, centralized in `lib/queries.ts` (portal)
  and `app/superadmin/queries.ts` (console). Ambiguous embedded joins need FK hints
  (`profiles!notifications_actor_profile_id_fkey`).
- **Server Actions are the security boundary** — re-check auth + permission *inside* the
  action; the nav/UI gate is cosmetic. `revalidatePath()` after mutations.
- **Best-effort side effects** (notifications, email, audit) are wrapped in try/catch and
  must **never** throw into the calling action.
- **Append-only history:** `memberships` / `member_permissions` are never updated in place
  — active = `ended_at IS NULL` / `revoked_at IS NULL`.
- **Edge-safety:** never pull `bcrypt` or a `server-only` module into `proxy.ts` /
  `auth.config.ts`. Read super-admin status from the JWT flag at the Edge.
- **Verification gate = `npm run build && npm test`** (not lint). Migrations are manual, so
  full runtime verification also needs the migration applied in Supabase.

---

## 4. Performance — the responsiveness model

> **Goal:** portal navigations that feel instant; server response budget **~100 ms**, down
> from the multi-second loads caused by redundant Supabase round-trips.

### 4.1 The core problem (fixed)

Every request-scoped read (the actor, the profile+membership, the permission set) was run
**2–3 times per navigation** — once in `proxy.ts`, again in `(portal)/layout.tsx`, and
again in the `page.tsx` (see the "copy-paste recipe" in `docs/ENGINEERING.md`). A single
page load chained **10–15 sequential PostgREST round-trips**, most of them duplicates.
Latency is dominated by *round-trip count × per-trip RTT*, not by SQL time.

**The fix is request-level memoization with React `cache()`** — one call per request,
every duplicate collapses onto it, and callers are unchanged:

| Function | File | Change |
| --- | --- | --- |
| `getEffectiveActor()` | `utils/auth/superadmin.ts` | wrapped in `cache()` |
| `getUserProfileWithMembership()` | `lib/queries.ts` | wrapped in `cache()` |
| `getAllUserMemberships()` | `lib/queries.ts` | wrapped in `cache()` |
| `getUserPermissions()` | `utils/auth/permissions.ts` | delegates to a `cache()`d core keyed on primitives |
| `isSuperAdmin()` | `utils/auth/superadmin.ts` | already `cache()`d (the pattern to copy) |

**`createAdminClient()` is now a module singleton** (`utils/supabase/server.ts`). The
client is stateless (`persistSession:false`), so one instance serves the whole process and
HTTP keep-alive is preserved instead of re-wiring PostgREST on every call.

`cache()` is per-request and behavior-preserving — a cache miss just does exactly what the
code did before, so these changes cannot regress correctness (including the fail-closed
status gate).

**Rule for new request-scoped reads:** if a read is keyed only on ids/session and may be
called from more than one of {proxy, layout, page, action} in a single request, wrap its
definition in `cache()`. Keep the args **primitive** (don't pass the `supabase` client as
an argument — `cache()` keys by reference and a fresh client defeats it; see how
`getUserPermissions` delegates to `getUserPermissionsCached`).

### 4.2 Client-side & build config (`next.config.ts`)

- `experimental.staleTimes.dynamic = 30` — the client Router Cache now reuses dynamic
  segments for 30 s, so back/forward and repeat navigations between the same handful of
  ops pages are instant. Server Actions still `revalidatePath()`, so freshness after a
  mutation is unaffected.
- `experimental.optimizePackageImports: ['@base-ui/react']` — tree-shake the UI kit
  (`lucide-react`/`recharts` are already optimized by default in this Next version).
- `serverExternalPackages: ['bcrypt']` — keep the native addon out of the server bundle.
- `poweredByHeader:false`, `compress:true`, `reactStrictMode:true`, `images.remotePatterns`
  (ImageKit + Google avatars).

### 4.3 Database

The schema is **already well-indexed** (`supabase/migrations/00012` + the per-feature
indexes). Indexes are *not* the bottleneck — the round-trip fan-out was. Migration
`00020_active_partial_indexes.sql` adds the two **partial** indexes the append-only hot
reads actually need (`memberships … WHERE ended_at IS NULL`, `member_permissions … WHERE
revoked_at IS NULL`) so active reads stay fast as historical rows accumulate forever.
Apply it in the Supabase SQL editor.

### 4.4 Tech-stack gaps — the "missing flags"

What the stack lacks today, why it matters for responsiveness, and the recommendation.
Status: ✅ done here · 🔜 roadmap.

| Capability | Missing? | Impact | Recommendation | Status |
| --- | --- | --- | --- | --- |
| Request-level read memoization | was missing | 2–3× duplicate round-trips per nav | React `cache()` on composite reads | ✅ |
| DB client reuse / keep-alive | was missing | re-wired PostgREST per call | singleton admin client | ✅ |
| Client Router Cache tuning | was default (0s) | every re-nav refetched | `staleTimes.dynamic` | ✅ |
| Partial indexes for append-only reads | claimed but absent | active reads scan dead rows | migration `00020` | ✅ |
| **Data cache for reference data** | missing | `branches`/`positions`/`event_types`/permission catalog refetched every load though they rarely change | Next Data Cache (`use cache` / `unstable_cache`) or a small in-memory TTL | 🔜 |
| **Observability / query timing** | missing | can't *prove* 100 ms or find the next slow path | wrap admin client with timing logs; add OpenTelemetry/Web Vitals reporting | 🔜 |
| **Fresh-status gate cost** | per-request DB read in `proxy.ts` | one unavoidable-looking round-trip on every navigation | short-TTL (≈15 s) cached status keyed on profile id — keeps near-freshness, cuts the per-nav read | 🔜 |
| **Client data layer (React Query/SWR)** | missing | no optimistic UI / client cache beyond router | adopt for interactive mutation-heavy pages | 🔜 |
| **ISR / static caching for public** | all routes dynamic (`ƒ`) | `/api/public/events` recomputed each hit | `revalidate` / route cache on public read paths | 🔜 |
| **React Compiler** | disabled | manual memoization, larger client work | `reactCompiler:true` (+`babel-plugin-react-compiler`) once verified | 🔜 |
| **Analytics aggregation** | loads all profiles into memory (`ENGINEERING §10`) | O(members) per analytics load | SQL aggregates / materialized view | 🔜 |
| **Rate limiting** | missing | auth/API abuse, tail latency | limiter on auth + mutation routes | 🔜 |
| **Bundle analyzer / error tracking** | missing | blind to bundle bloat & prod errors | `@next/bundle-analyzer`, Sentry | 🔜 |

When you pick up a 🔜 item, measure first (add timing), change one thing, re-measure, and
update this table.

---

## 5. Common workflows

- **Add a portal feature:** follow the copy-paste recipe in `docs/ENGINEERING.md` §"Adding
  a feature" (page → nav entry → action → notification → verify). Reuse `lib/queries.ts`;
  don't inline new one-off queries in pages.
- **Add a query:** put portal reads in `lib/queries.ts`, console reads in
  `app/superadmin/queries.ts`. Memoize per §4.1 if request-scoped.
- **Mutate:** `'use server'` action → re-check permission → admin client → best-effort
  `notify*`/audit → `revalidatePath('/', 'layout')`.
- **Verify:** `npm run build && npm test`. Apply any new migration in Supabase. Smoke-test.

---

## 6. Migrations (manual)

SQL files in `supabase/migrations/`, numbered `000NN_name.sql`, **applied by hand in the
Supabase SQL editor** — there is no runner. Write code that **degrades** when a migration
isn't applied yet (reads selecting new columns wrap in try/catch and return empty). When
you add one: keep the numbering, add it to `docs/SCHEMA.md` §10 + the README setup list,
and note if a feature depends on it. Migration `00020` (this change) is additive and safe.

---

## 7. Sharp edges to remember

- **`graphify-out/` does not exist** in this checkout — `graphify query` won't work; ignore
  that guidance until the graph is generated (`graphify update .`).
- `setPositionPermissions` is non-atomic (delete-then-insert, two REST calls).
- `deletePosition` must count **all** memberships (FK `RESTRICT`).
- Search terms interpolated into `.or(...ilike...)` **must** go through
  `sanitizeSearchTerm` first.
- The portal top bar always shows "Dashboard"; some Events nav links are dead (see
  `docs/features/events.md`).
- The JWT's `token.status` is **stale** (written once at sign-in). Portal access is gated on
  a **fresh** `profiles.status` read in `proxy.ts` and the portal layout — never use the JWT
  status as the source of truth for access.
