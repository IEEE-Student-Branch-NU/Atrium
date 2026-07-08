# Super Admin Portal — Phase 1: Foundation & Impersonation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the isolated `/superadmin` route group with direct-login access, a super-admin identity flag carried in the JWT, workspace impersonation, an audit-log foundation, and removal of the dead `/sudo` passphrase system — a working, guarded, (empty) portal ready for feature modules.

**Architecture:** One Next.js app, two isolated surfaces. Super-admin identity is computed once at sign-in (bcrypt against the existing hashed `superadmins` table, in Node) and stamped into the next-auth JWT as `isSuperAdmin`, so middleware (Edge) and pages read a flag instead of re-running bcrypt. Impersonation is a signed httpOnly cookie that the `(portal)` layout resolves via `getEffectiveActor()`, with `auth()` still returning the real super admin so mutations are attributed correctly. All super-admin mutations write to a new `audit_log` table.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, next-auth v5 (JWT sessions), Supabase JS (service-role admin client), Base UI (`@base-ui/react`) components, `jose` (cookie signing), `bcrypt` (Node only), Vitest (new, for pure-logic unit tests).

## Global Constraints

- **Next.js 16 has breaking changes vs. training data** — before writing framework code, verify APIs in `node_modules/next/dist/docs/`. (Per `AGENTS.md`.)
- **Supabase access is service-role only** via `createAdminClient()` from `src/utils/supabase/server.ts`. Never use a browser client. RLS is bypassed, so **every** page and action enforces its own authorization.
- **bcrypt is Node-only** — never call it from Edge middleware.
- **Server Actions** for all mutations; **Server Components** by default; `'use client'` only when needed.
- **Auth domain:** `@nirmauni.ac.in`. Super-admin roster source of truth: the `superadmins` table (bcrypt-hashed emails).
- **Base UI render-prop API:** triggers use `render={<Button .../>}` (not `asChild`). Match `src/components/portal/sidebar.tsx`.
- After code changes, run `graphify update .` is optional; the hard gates are `npm run build` and `npm run lint`.

---

### Task 1: Add Vitest for pure-logic unit tests

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.ts`
- Create: `src/utils/auth/__tests__/sanity.test.ts`

**Interfaces:**
- Produces: `npm test` runs Vitest once; `npm run test:watch` watches. Test files live in `__tests__/` folders next to the code.

- [ ] **Step 1: Install Vitest**

Run: `npm i -D vitest@^2`
Expected: adds `vitest` to devDependencies, no peer errors.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 3: Add scripts to `package.json`**

In `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a sanity test**

`src/utils/auth/__tests__/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('vitest wiring', () => {
  it('runs and resolves the @ alias config', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run and verify it passes**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/utils/auth/__tests__/sanity.test.ts
git commit -m "chore: add vitest for pure-logic unit tests"
```

---

### Task 2: `isSuperAdmin` identity helper (pure matcher + DB wrapper)

**Files:**
- Create: `src/utils/auth/superadmin.ts`
- Create: `src/utils/auth/__tests__/superadmin.test.ts`

**Interfaces:**
- Produces:
  - `matchesSuperAdmin(email: string, rows: { hashed_email: string }[]): Promise<boolean>` — pure (no IO); bcrypt-compares email against each row.
  - `isSuperAdmin(email: string | null | undefined): Promise<boolean>` — fetches `superadmins` rows via `createAdminClient()` and delegates to `matchesSuperAdmin`; memoized per request with `react`'s `cache`.

- [ ] **Step 1: Write the failing test**

`src/utils/auth/__tests__/superadmin.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import bcrypt from 'bcrypt'
import { matchesSuperAdmin } from '@/utils/auth/superadmin'

describe('matchesSuperAdmin', () => {
  it('returns true when the email matches a hashed_email row', async () => {
    const rows = [{ hashed_email: bcrypt.hashSync('ieee@nirmauni.ac.in', 10) }]
    expect(await matchesSuperAdmin('ieee@nirmauni.ac.in', rows)).toBe(true)
  })

  it('returns false when no row matches', async () => {
    const rows = [{ hashed_email: bcrypt.hashSync('ieee@nirmauni.ac.in', 10) }]
    expect(await matchesSuperAdmin('someone@nirmauni.ac.in', rows)).toBe(false)
  })

  it('returns false for empty rows', async () => {
    expect(await matchesSuperAdmin('ieee@nirmauni.ac.in', [])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- superadmin`
Expected: FAIL — `matchesSuperAdmin` not exported.

- [ ] **Step 3: Write the implementation**

`src/utils/auth/superadmin.ts`:
```ts
import 'server-only'
import { cache } from 'react'
import bcrypt from 'bcrypt'
import { createAdminClient } from '@/utils/supabase/server'

/**
 * Pure matcher: true if `email` bcrypt-matches any row's hashed_email.
 * No IO — unit-testable.
 */
export async function matchesSuperAdmin(
  email: string,
  rows: { hashed_email: string }[]
): Promise<boolean> {
  for (const row of rows) {
    if (await bcrypt.compare(email, row.hashed_email)) return true
  }
  return false
}

/**
 * True if the email belongs to a super admin (source of truth: `superadmins`).
 * Node-only (bcrypt). Memoized per request.
 */
export const isSuperAdmin = cache(async (email: string | null | undefined): Promise<boolean> => {
  if (!email) return false
  const supabase = createAdminClient()
  const { data } = await supabase.from('superadmins').select('hashed_email')
  if (!data || data.length === 0) return false
  return matchesSuperAdmin(email, data)
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- superadmin`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/utils/auth/superadmin.ts src/utils/auth/__tests__/superadmin.test.ts
git commit -m "feat: add isSuperAdmin identity helper with pure matcher"
```

---

### Task 3: Stamp `isSuperAdmin` into the JWT + type augmentation

**Files:**
- Modify: `src/auth.ts` (jwt + session callbacks)
- Modify: `src/auth.config.ts` (session callback shape, if callbacks live here — see note)
- Create: `types/next-auth.d.ts`
- Modify: `tsconfig.json` (ensure `types/` is included — it is via `"include": ["**/*.ts", ...]`; verify)

**Interfaces:**
- Consumes: `isSuperAdmin` (Task 2).
- Produces: `session.isSuperAdmin: boolean` and `token.isSuperAdmin: boolean`, set at sign-in. Edge-safe to read (no bcrypt at read time).

**Note:** The `jwt` callback runs in the Node auth instance (`src/auth.ts`). Compute `isSuperAdmin` there (bcrypt is fine in Node). The `session` callback must expose it; if the base `session` callback is in `auth.config.ts`, override/extend in `auth.ts`. Read the current callback locations before editing.

- [ ] **Step 1: Add the type augmentation**

`types/next-auth.d.ts`:
```ts
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    isSuperAdmin?: boolean
    status?: string
    isMembershipComplete?: boolean
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isSuperAdmin?: boolean
    profileId?: string
    status?: string
    isMembershipComplete?: boolean
  }
}
```

- [ ] **Step 2: Set `token.isSuperAdmin` in the jwt callback**

In `src/auth.ts`, inside the `jwt` callback where `user` is present at sign-in, after existing `token.profileId` assignment, add:
```ts
// Compute once at sign-in (Node context — bcrypt is available here).
token.isSuperAdmin = await isSuperAdmin(user.email ?? token.email ?? null)
```
Add the import at the top: `import { isSuperAdmin } from '@/utils/auth/superadmin'`.

- [ ] **Step 3: Expose it on the session**

In the `session` callback (wherever it currently sets `session.user.id`), add:
```ts
session.isSuperAdmin = token.isSuperAdmin === true
```
Remove the `as any` casts for `status` / `isMembershipComplete` now that the Session type is augmented.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: compiles; no type errors about `session.isSuperAdmin`.

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts src/auth.config.ts types/next-auth.d.ts
git commit -m "feat: carry isSuperAdmin flag in the next-auth JWT/session"
```

---

### Task 4: Impersonation cookie utils + `getEffectiveActor`

**Files:**
- Create: `src/utils/auth/impersonation.ts`
- Modify: `src/utils/auth/superadmin.ts` (add `getEffectiveActor` + pure `resolveEffectiveActor`)
- Create: `src/utils/auth/__tests__/effective-actor.test.ts`

**Interfaces:**
- Produces:
  - `IMPERSONATE_COOKIE = 'atrium_impersonate'`
  - `setImpersonation(membershipId: string): Promise<void>`
  - `getImpersonatedMembershipId(): Promise<string | null>`
  - `clearImpersonation(): Promise<void>`
  - `type EffectiveActor = { realProfileId: string | null; realEmail: string | null; isSuperAdmin: boolean; isImpersonating: boolean; actingProfileId: string | null; actingMembershipId: string | null }`
  - `resolveEffectiveActor(input): EffectiveActor` — pure
  - `getEffectiveActor(): Promise<EffectiveActor>` — IO wrapper

- [ ] **Step 1: Write the impersonation cookie utils**

`src/utils/auth/impersonation.ts`:
```ts
import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)
export const IMPERSONATE_COOKIE = 'atrium_impersonate'

export async function setImpersonation(membershipId: string) {
  const token = await new SignJWT({ membershipId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('4h')
    .sign(secret)
  const store = await cookies()
  store.set(IMPERSONATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4,
  })
}

export async function getImpersonatedMembershipId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(IMPERSONATE_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    return typeof payload.membershipId === 'string' ? payload.membershipId : null
  } catch {
    return null
  }
}

export async function clearImpersonation() {
  const store = await cookies()
  store.delete(IMPERSONATE_COOKIE)
}
```

- [ ] **Step 2: Write the failing test for `resolveEffectiveActor`**

`src/utils/auth/__tests__/effective-actor.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveEffectiveActor } from '@/utils/auth/superadmin'

describe('resolveEffectiveActor', () => {
  it('acts as self when not impersonating', () => {
    const a = resolveEffectiveActor({
      realProfileId: 'sa-1', realEmail: 'ieee@nirmauni.ac.in', isSuperAdmin: true,
      impersonatedMembership: null,
    })
    expect(a.isImpersonating).toBe(false)
    expect(a.actingProfileId).toBe('sa-1')
    expect(a.actingMembershipId).toBe(null)
  })

  it('acts as target membership when a super admin impersonates', () => {
    const a = resolveEffectiveActor({
      realProfileId: 'sa-1', realEmail: 'ieee@nirmauni.ac.in', isSuperAdmin: true,
      impersonatedMembership: { id: 'm-9', profile_id: 'user-7' },
    })
    expect(a.isImpersonating).toBe(true)
    expect(a.actingProfileId).toBe('user-7')
    expect(a.actingMembershipId).toBe('m-9')
  })

  it('ignores impersonation for a non-super-admin', () => {
    const a = resolveEffectiveActor({
      realProfileId: 'user-2', realEmail: 'x@nirmauni.ac.in', isSuperAdmin: false,
      impersonatedMembership: { id: 'm-9', profile_id: 'user-7' },
    })
    expect(a.isImpersonating).toBe(false)
    expect(a.actingProfileId).toBe('user-2')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- effective-actor`
Expected: FAIL — `resolveEffectiveActor` not exported.

- [ ] **Step 4: Implement `resolveEffectiveActor` + `getEffectiveActor`**

Append to `src/utils/auth/superadmin.ts`:
```ts
import { auth } from '@/auth'
import { getImpersonatedMembershipId } from '@/utils/auth/impersonation'

export type EffectiveActor = {
  realProfileId: string | null
  realEmail: string | null
  isSuperAdmin: boolean
  isImpersonating: boolean
  actingProfileId: string | null
  actingMembershipId: string | null
}

type ResolveInput = {
  realProfileId: string | null
  realEmail: string | null
  isSuperAdmin: boolean
  impersonatedMembership: { id: string; profile_id: string } | null
}

/** Pure resolution — unit-testable. Only super admins may impersonate. */
export function resolveEffectiveActor(input: ResolveInput): EffectiveActor {
  const canImpersonate = input.isSuperAdmin && input.impersonatedMembership != null
  return {
    realProfileId: input.realProfileId,
    realEmail: input.realEmail,
    isSuperAdmin: input.isSuperAdmin,
    isImpersonating: canImpersonate,
    actingProfileId: canImpersonate ? input.impersonatedMembership!.profile_id : input.realProfileId,
    actingMembershipId: canImpersonate ? input.impersonatedMembership!.id : null,
  }
}

/** IO wrapper: reads session + impersonation cookie, validates the target membership is active. */
export async function getEffectiveActor(): Promise<EffectiveActor> {
  const session = await auth()
  const realProfileId = session?.user?.id ?? null
  const realEmail = session?.user?.email ?? null
  const isSA = session?.isSuperAdmin === true

  let impersonatedMembership: { id: string; profile_id: string } | null = null
  if (isSA) {
    const membershipId = await getImpersonatedMembershipId()
    if (membershipId) {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('memberships')
        .select('id, profile_id')
        .eq('id', membershipId)
        .is('ended_at', null)
        .single()
      if (data) impersonatedMembership = { id: data.id, profile_id: data.profile_id }
    }
  }

  return resolveEffectiveActor({ realProfileId, realEmail, isSuperAdmin: isSA, impersonatedMembership })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- effective-actor`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/utils/auth/impersonation.ts src/utils/auth/superadmin.ts src/utils/auth/__tests__/effective-actor.test.ts
git commit -m "feat: add impersonation cookie utils and getEffectiveActor"
```

---

### Task 5: Switch the permission engine to the session flag; delete `/sudo`; fix stale `is_super_admin`

**Files:**
- Modify: `src/utils/auth/permissions.ts`
- Delete: `src/utils/auth/sudo.ts`, `src/app/sudo/page.tsx`, `src/app/sudo/actions.ts`
- Modify: `src/lib/queries.ts` (remove `is_super_admin` selects in `getUserProfileWithMembership`, `getFullUserProfile`)
- Modify: `src/app/(portal)/notifications/page.tsx` and `src/app/(portal)/notifications/actions.ts` (replace `is_super_admin` gate with `session.isSuperAdmin`)

**Interfaces:**
- Consumes: `session.isSuperAdmin` (Task 3).
- Produces: `getUserPermissions` / `canApproveRegistrations` return `['*']` / `true` when the current session is a super admin (including while impersonating).

- [ ] **Step 1: Replace the sudo short-circuit in `permissions.ts`**

At the top of `getUserPermissions`, replace:
```ts
if (await isSudoMode()) {
  return [WILDCARD]
}
```
with:
```ts
const session = await auth()
if (session?.isSuperAdmin) {
  return [WILDCARD]
}
```
And in `canApproveRegistrations`, replace `if (await isSudoMode()) return true` with:
```ts
const session = await auth()
if (session?.isSuperAdmin) return true
```
Update imports: remove `import { isSudoMode } from '@/utils/auth/sudo'`; add `import { auth } from '@/auth'`.

- [ ] **Step 2: Delete the dead sudo system**

```bash
git rm src/utils/auth/sudo.ts src/app/sudo/page.tsx src/app/sudo/actions.ts
```

- [ ] **Step 3: Fix stale `is_super_admin` reads**

In `src/lib/queries.ts`, remove `is_super_admin` from the `.select(...)` strings in `getUserProfileWithMembership` and `getFullUserProfile`, and drop it from any returned object shape. In `src/app/(portal)/notifications/page.tsx` and `actions.ts`, replace the `profile.is_super_admin` / DB check used to gate the broadcast composer with:
```ts
const session = await auth()
const canBroadcast = session?.isSuperAdmin === true
```
(Import `auth` from `@/auth` where needed.)

- [ ] **Step 4: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected: all pass; no remaining references to `isSudoMode` or `is_super_admin` (grep to confirm: `grep -rn "isSudoMode\|is_super_admin" src` returns nothing).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: replace sudo cookie with session isSuperAdmin; remove /sudo; fix stale is_super_admin reads"
```

---

### Task 6: `audit_log` migration + `logAdminAction`

**Files:**
- Create: `supabase/migrations/00008_audit_log.sql`
- Create: `src/utils/auth/audit.ts`

**Interfaces:**
- Produces:
  - `type AdminAction = { actorProfileId: string; action: string; entityType: 'organization'|'branch'|'position'|'user'|'membership'|'permission'|'workspace'; entityId?: string | null; branchId?: string | null; summary: string; details?: Record<string, unknown> | null }`
  - `logAdminAction(a: AdminAction): Promise<void>`
  - `getAuditLog(opts): Promise<AuditEntry[]>` is defined later (Phase 2); this task only creates the table + writer.

- [ ] **Step 1: Write the migration**

`supabase/migrations/00008_audit_log.sql`:
```sql
-- ============================================================
-- Migration 00008: Unified audit_log for super-admin / structural actions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id  UUID NOT NULL REFERENCES profiles(id),
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         UUID,
  branch_id         UUID REFERENCES branches(id),
  summary           TEXT NOT NULL,
  details           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON public.audit_log(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity  ON public.audit_log(entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY; -- service-role only; no public policies
```

- [ ] **Step 2: Apply the migration**

Manual: run `supabase/migrations/00008_audit_log.sql` in the Supabase SQL editor (this project applies migrations manually — see README §4). Confirm the table exists.

- [ ] **Step 3: Write `logAdminAction`**

`src/utils/auth/audit.ts`:
```ts
import 'server-only'
import { createAdminClient } from '@/utils/supabase/server'

export type AdminAction = {
  actorProfileId: string
  action: string
  entityType: 'organization' | 'branch' | 'position' | 'user' | 'membership' | 'permission' | 'workspace'
  entityId?: string | null
  branchId?: string | null
  summary: string
  details?: Record<string, unknown> | null
}

/** Best-effort audit write. Never throws into the caller — a failed audit must not break the action. */
export async function logAdminAction(a: AdminAction): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      actor_profile_id: a.actorProfileId,
      action: a.action,
      entity_type: a.entityType,
      entity_id: a.entityId ?? null,
      branch_id: a.branchId ?? null,
      summary: a.summary,
      details: a.details ?? null,
    })
  } catch (e) {
    console.error('logAdminAction failed', e)
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00008_audit_log.sql src/utils/auth/audit.ts
git commit -m "feat: add audit_log table and logAdminAction writer"
```

---

### Task 7: Middleware routing for super admins

**Files:**
- Modify: `src/utils/supabase/middleware.ts`

**Interfaces:**
- Consumes: `token.isSuperAdmin` via `req.auth` (Edge-safe flag from Task 3).
- Produces: super admins are routed to `/superadmin`; non-super-admins are blocked from `/superadmin/*`.

**Note:** Read the current `authMiddleware` signature first. It receives the request with `req.auth` (the session) from the next-auth wrapper. Do NOT call `isSuperAdmin()` here (bcrypt is not Edge-safe) — read the flag off the session/token only.

- [ ] **Step 1: Add the super-admin routing rules**

In `authMiddleware`, after the "not logged in → /login" guard and before the status gating, add:
```ts
const isSA = (req.auth as { isSuperAdmin?: boolean } | null)?.isSuperAdmin === true
const path = req.nextUrl.pathname

// Block non-super-admins from the portal entirely.
if (path.startsWith('/superadmin') && !isSA) {
  return NextResponse.redirect(new URL('/', req.url))
}

// Route super admins straight into their portal from the app root.
if (isSA && path === '/') {
  return NextResponse.redirect(new URL('/superadmin', req.url))
}
```
Ensure `/superadmin` is treated as a protected (authenticated) route by the existing logic (it is not public and not auth-only, so the default authenticated handling applies). Import `NextResponse` if not already imported.

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: pass.

- [ ] **Step 3: Manual verification (deferred until Task 8 gives the portal a page)**

Note in the commit message that end-to-end routing is verified in Task 8 once `/superadmin` renders.

- [ ] **Step 4: Commit**

```bash
git add src/utils/supabase/middleware.ts
git commit -m "feat: route super admins to /superadmin and block others"
```

---

### Task 8: Super-admin route group — layout guard, sidebar, placeholder dashboard

**Files:**
- Create: `src/app/superadmin/layout.tsx`
- Create: `src/app/superadmin/page.tsx` (placeholder — real dashboard in Phase 2)
- Create: `src/components/superadmin/sidebar.tsx`
- Create: `src/components/superadmin/top-bar.tsx`

**Interfaces:**
- Consumes: `auth()`, `session.isSuperAdmin`.
- Produces: a guarded `/superadmin` surface with the full sidebar nav (Dashboard, Organizations, Users, Positions, Position Requests, Audit Logs, Settings, Logout). Later Phase-2 pages drop into this layout.

- [ ] **Step 1: Create the sidebar**

`src/components/superadmin/sidebar.tsx` — client component. Model it on `src/components/portal/sidebar.tsx` (same Base UI patterns, collapsible desktop + `Sheet` mobile), but with a **static** nav (no permission gating — super admins see everything) and a "SUPER ADMIN" badge in the header. Nav items:
```ts
const NAV = [
  { label: 'Dashboard', href: '/superadmin', icon: LayoutDashboard },
  { label: 'Organizations', href: '/superadmin/organizations', icon: Building2 },
  { label: 'Users', href: '/superadmin/users', icon: Users },
  { label: 'Positions', href: '/superadmin/positions', icon: BadgeCheck },
  { label: 'Position Requests', href: '/superadmin/position-requests', icon: Inbox },
  { label: 'Audit Logs', href: '/superadmin/audit', icon: ScrollText },
  { label: 'Settings', href: '/superadmin/settings', icon: Settings },
]
```
Active highlight: `item.href === '/superadmin' ? pathname === '/superadmin' : pathname.startsWith(item.href)`. Logout uses the existing `signOut` server action from `src/app/auth/actions.ts`.

- [ ] **Step 2: Create the top bar**

`src/components/superadmin/top-bar.tsx` — shows the current page title + the super admin's name/email and a theme toggle (reuse the pattern from `src/components/portal/top-bar.tsx`, minus the workspace/notification bits).

- [ ] **Step 3: Create the guarded layout**

`src/app/superadmin/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { SuperAdminSidebar } from '@/components/superadmin/sidebar'
import { SuperAdminTopBar } from '@/components/superadmin/top-bar'
import { TooltipProvider } from '@/components/ui/tooltip'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!session.isSuperAdmin) redirect('/')

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        <SuperAdminSidebar user={session.user} />
        <div className="flex-1 flex flex-col">
          <SuperAdminTopBar user={session.user} />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}
```

- [ ] **Step 4: Create the placeholder dashboard**

`src/app/superadmin/page.tsx`:
```tsx
export default function SuperAdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Super Admin Dashboard</h1>
      <p className="text-sm text-muted-foreground mt-2">Modules land here in Phase 2.</p>
    </div>
  )
}
```

- [ ] **Step 5: Verify build + lint + manual routing**

Run: `npm run build && npm run lint`
Then manually (`npm run dev`): as a super-admin account, visiting `/` redirects to `/superadmin` and renders the placeholder with the sidebar; as a non-super-admin, visiting `/superadmin` redirects to `/`.

- [ ] **Step 6: Commit**

```bash
git add src/app/superadmin src/components/superadmin
git commit -m "feat: guarded /superadmin route group with sidebar and top bar"
```

---

### Task 9: Impersonation — open/exit actions, banner, portal touch points

**Files:**
- Create: `src/app/superadmin/actions.ts` (start it here with `openWorkspace` / `exitWorkspace`)
- Create: `src/components/superadmin/impersonation-banner.tsx`
- Modify: `src/app/(portal)/layout.tsx`
- Modify: `src/app/(portal)/page.tsx`, `src/app/(portal)/profile/page.tsx`, `src/app/(portal)/position-requests/page.tsx` (use `getEffectiveActor().actingProfileId`/`actingMembershipId` instead of `session.user.id` for **display data**)

**Interfaces:**
- Consumes: `getEffectiveActor`, `setImpersonation`, `clearImpersonation`, `logAdminAction`, `session.isSuperAdmin`.
- Produces: `openWorkspace(membershipId: string): Promise<{ success?: boolean; error?: string }>`, `exitWorkspace(): Promise<void>`.

- [ ] **Step 1: Write `openWorkspace` / `exitWorkspace`**

`src/app/superadmin/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { setImpersonation, clearImpersonation } from '@/utils/auth/impersonation'
import { logAdminAction } from '@/utils/auth/audit'

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.isSuperAdmin || !session.user?.id) return null
  return session
}

export async function openWorkspace(membershipId: string) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }

  const supabase = createAdminClient()
  const { data: membership } = await supabase
    .from('memberships')
    .select('id, profile_id, branch_id, position_id, profiles(full_name), branches(name), positions(name)')
    .eq('id', membershipId)
    .is('ended_at', null)
    .single()
  if (!membership) return { error: 'Membership not found' }

  await setImpersonation(membershipId)
  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'workspace_opened',
    entityType: 'workspace',
    entityId: membershipId,
    branchId: membership.branch_id,
    summary: `Opened workspace of ${(membership.profiles as any)?.full_name ?? membership.profile_id}`,
    details: { membershipId, profileId: membership.profile_id },
  })
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function exitWorkspace() {
  await clearImpersonation()
  revalidatePath('/', 'layout')
  redirect('/superadmin')
}
```

- [ ] **Step 2: Write the banner**

`src/components/superadmin/impersonation-banner.tsx`:
```tsx
import { exitWorkspace } from '@/app/superadmin/actions'
import { Button } from '@/components/ui/button'

export function ImpersonationBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/15 border-b border-amber-500/40 px-4 py-2 text-sm">
      <span className="font-medium text-amber-700 dark:text-amber-300">
        Viewing {name}&apos;s workspace — Super Admin mode
      </span>
      <form action={exitWorkspace}>
        <Button type="submit" size="sm" variant="outline">Exit workspace</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Wire the banner + effective actor into the portal layout**

In `src/app/(portal)/layout.tsx`, replace the direct `session.user.id` usage that resolves the profile with `getEffectiveActor()`:
```tsx
const actor = await getEffectiveActor()
if (!actor.realProfileId) redirect('/login')
const activeWorkspaceId = actor.isImpersonating ? actor.actingMembershipId : await getActiveWorkspace()
const profile = await getUserProfileWithMembership(actor.actingProfileId!, activeWorkspaceId)
```
Then, when `actor.isImpersonating`, render `<ImpersonationBanner name={profile.full_name} />` above the page content. Permissions still come from `getUserPermissions(...)`, which returns `['*']` because the real session is a super admin.

- [ ] **Step 4: Update the other portal pages that read the current user for display**

In `src/app/(portal)/page.tsx`, `profile/page.tsx`, and `position-requests/page.tsx`, replace `session.user.id` (used to load the displayed profile/requests) with `(await getEffectiveActor()).actingProfileId`. Leave any mutation attribution on the real session id. (Search each file for `session.user.id` and adjust only the display-data reads.)

- [ ] **Step 5: Verify build + lint + manual impersonation flow**

Run: `npm run build && npm run lint`
Manual (`npm run dev`): as a super admin, call `openWorkspace` for a member's membership id (temporary test button or direct nav after Phase 2 wires the buttons) → redirected to `/` showing that member's context with the amber banner; "Exit workspace" returns to `/superadmin`; an `audit_log` row `workspace_opened` exists.

- [ ] **Step 6: Commit**

```bash
git add src/app/superadmin/actions.ts src/components/superadmin/impersonation-banner.tsx src/app/\(portal\)/
git commit -m "feat: workspace impersonation with banner and audit"
```

---

## Phase 1 Self-Review

- **Spec coverage:** §5 access/identity → Tasks 2,3,5,7. §5.4 sudo removal + split-brain fix → Task 5. §6 impersonation → Tasks 4,9. §8 audit table → Task 6. Route-group skeleton (§4) → Task 8. §12 verification (Vitest for pure logic) → Task 1 + tests in 2,4. Modules (§9) are Phase 2. ✅
- **Edge/bcrypt constraint:** resolved by JWT stamping (Task 3) so middleware (Task 7) reads a flag. ✅
- **Type consistency:** `EffectiveActor`, `AdminAction`, `openWorkspace`/`exitWorkspace`, `isSuperAdmin`, `session.isSuperAdmin` used consistently across tasks. ✅
- **Deviation from spec noted:** §5.5 (JWT stamping) is now the chosen approach rather than deferred, because Edge middleware cannot run bcrypt. Confirm acceptable.

## After Phase 1

You have a guarded, empty `/superadmin` portal, super admins auto-routed on login, working impersonation with a banner, an audit-log foundation, and the dead `/sudo` system removed. Proceed to **Phase 2 — Modules**.
