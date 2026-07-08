# Super Admin Portal — Phase 2: Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Depends on Phase 1** (`2026-07-08-super-admin-portal-phase1-foundation.md`). Consumes: `session.isSuperAdmin`, `getEffectiveActor`, `logAdminAction`, the `/superadmin` layout + sidebar, `openWorkspace`, and the `audit_log` table.

**Goal:** Build the seven super-admin modules — Dashboard, Organizations, Users, Positions, Position Requests, Audit Logs, Settings — on the Phase 1 foundation, all reading real data and writing to `audit_log`.

**Architecture:** Server Components load data via new helpers in `src/app/superadmin/queries.ts`; mutations are Server Actions in `src/app/superadmin/actions.ts`, each guarded by `requireSuperAdmin()` and audited via `logAdminAction`. UI follows the existing `(portal)` pattern (server component → in-page data load → shadcn/Base-UI components; `'use client'` islands only for interactivity).

**Tech Stack:** Same as Phase 1. New shadcn/Base-UI primitives added on demand: `checkbox`, `switch` (via `npx shadcn@latest add <name>`).

## Global Constraints

- Same as Phase 1 (Next.js 16 doc-check, service-role-only DB, all authz in app code, Base UI render-prop API, Server Actions for mutations).
- **Vocabulary mapping (presentation only, no schema change):** branch with `parent_id IS NULL` = **Organization**; direct child = **Branch**; deeper = **Sub-Branch**.
- **Every mutation** re-verifies super admin via `requireSuperAdmin()` and calls `logAdminAction`.
- **Documents, Tasks, Teams, branch deletion, and password reset are OUT of scope** (deferred). The Reset Password control renders **disabled**.

---

### Task 1: Position classifier (Exec vs Associate)

**Files:**
- Create: `src/utils/positions.ts`
- Create: `src/utils/__tests__/positions.test.ts`

**Interfaces:**
- Produces:
  - `LEADERSHIP_POSITIONS: readonly string[]` = `['Chair', 'Vice Chair', 'General Secretary', 'Technical Head', 'Creative Head', 'MDO']`
  - `isLeadershipPosition(name: string | null | undefined): boolean` — case-insensitive, trims.
  - `classifyMembers<T extends { position_name: string | null }>(members: T[]): { exec: T[]; associates: T[] }`

- [ ] **Step 1: Write the failing test**

`src/utils/__tests__/positions.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isLeadershipPosition, classifyMembers } from '@/utils/positions'

describe('isLeadershipPosition', () => {
  it('matches leadership titles case-insensitively', () => {
    expect(isLeadershipPosition('Chair')).toBe(true)
    expect(isLeadershipPosition('  technical head ')).toBe(true)
  })
  it('rejects associate/general titles and null', () => {
    expect(isLeadershipPosition('Technical Associate')).toBe(false)
    expect(isLeadershipPosition(null)).toBe(false)
  })
})

describe('classifyMembers', () => {
  it('splits members into exec and associates', () => {
    const r = classifyMembers([
      { position_name: 'Chair' },
      { position_name: 'Technical Associate' },
      { position_name: null },
    ])
    expect(r.exec).toHaveLength(1)
    expect(r.associates).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- positions`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/utils/positions.ts`:
```ts
export const LEADERSHIP_POSITIONS = [
  'Chair', 'Vice Chair', 'General Secretary', 'Technical Head', 'Creative Head', 'MDO',
] as const

export function isLeadershipPosition(name: string | null | undefined): boolean {
  if (!name) return false
  const n = name.trim().toLowerCase()
  return LEADERSHIP_POSITIONS.some((p) => p.toLowerCase() === n)
}

export function classifyMembers<T extends { position_name: string | null }>(
  members: T[]
): { exec: T[]; associates: T[] } {
  const exec: T[] = []
  const associates: T[] = []
  for (const m of members) {
    if (isLeadershipPosition(m.position_name)) exec.push(m)
    else associates.push(m)
  }
  return { exec, associates }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- positions`
Expected: passed.

- [ ] **Step 5: Commit**

```bash
git add src/utils/positions.ts src/utils/__tests__/positions.test.ts
git commit -m "feat: add exec/associate position classifier"
```

---

### Task 2: Dashboard — stats, org tree, recent activity

**Files:**
- Create: `src/app/superadmin/queries.ts` (start it here)
- Modify: `src/app/superadmin/page.tsx` (replace the Phase 1 placeholder)

**Interfaces:**
- Produces:
  - `getSuperAdminStats(): Promise<{ totalUsers: number; totalOrganizations: number; totalBranches: number; totalPositions: number; pendingPositionRequests: number }>`
  - `type OrgNode = { id: string; name: string; slug: string; description: string | null; parent_id: string | null; memberCount: number; children: OrgNode[] }`
  - `getOrganizationTree(): Promise<OrgNode[]>`
  - `type ActivityItem = { id: string; actor: string; summary: string; created_at: string; source: 'audit' | 'event' | 'membership' }`
  - `getRecentActivityFeed(limit?: number): Promise<ActivityItem[]>`

- [ ] **Step 1: Write the query helpers**

`src/app/superadmin/queries.ts`:
```ts
import 'server-only'
import { createAdminClient } from '@/utils/supabase/server'

export async function getSuperAdminStats() {
  const supabase = createAdminClient()
  const [users, branches, roots, positions, reqs] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('branches').select('id', { count: 'exact', head: true }),
    supabase.from('branches').select('id', { count: 'exact', head: true }).is('parent_id', null),
    supabase.from('positions').select('id', { count: 'exact', head: true }),
    supabase.from('position_requests').select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'under_review']),
  ])
  return {
    totalUsers: users.count ?? 0,
    totalBranches: branches.count ?? 0,
    totalOrganizations: roots.count ?? 0,
    totalPositions: positions.count ?? 0,
    pendingPositionRequests: reqs.count ?? 0,
  }
}

export type OrgNode = {
  id: string; name: string; slug: string; description: string | null
  parent_id: string | null; memberCount: number; children: OrgNode[]
}

export async function getOrganizationTree(): Promise<OrgNode[]> {
  const supabase = createAdminClient()
  const { data: branches } = await supabase
    .from('branches').select('id, name, slug, description, parent_id').order('name')
  const { data: members } = await supabase
    .from('memberships').select('branch_id').is('ended_at', null)

  const counts = new Map<string, number>()
  for (const m of members ?? []) counts.set(m.branch_id, (counts.get(m.branch_id) ?? 0) + 1)

  const nodes = new Map<string, OrgNode>()
  for (const b of branches ?? []) {
    nodes.set(b.id, { ...b, memberCount: counts.get(b.id) ?? 0, children: [] })
  }
  const roots: OrgNode[] = []
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) nodes.get(node.parent_id)!.children.push(node)
    else roots.push(node)
  }
  return roots
}

export type ActivityItem = {
  id: string; actor: string; summary: string; created_at: string
  source: 'audit' | 'event' | 'membership'
}

export async function getRecentActivityFeed(limit = 10): Promise<ActivityItem[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('audit_log')
    .select('id, summary, created_at, profiles!audit_log_actor_profile_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id,
    actor: (r.profiles as any)?.full_name ?? 'Unknown',
    summary: r.summary,
    created_at: r.created_at,
    source: 'audit' as const,
  }))
}
```

> **Note:** verify the FK constraint name `audit_log_actor_profile_id_fkey` against the generated schema; if Supabase named it differently, use `profiles!actor_profile_id(full_name)` embed syntax instead.

- [ ] **Step 2: Build the dashboard page**

`src/app/superadmin/page.tsx` — server component. Load `getSuperAdminStats()`, `getOrganizationTree()`, `getRecentActivityFeed(8)`. Render:
- A 6-card stat grid (reuse `Card` from `@/components/ui/card`): Total Users, Total Organizations, Total Branches, Total Positions, Pending Position Requests, and a small "Recent Activity" count/link.
- The **Organizations & Branches** tree: each root org as a section header linking to `/superadmin/organizations/[id]`, children indented, showing `memberCount`.
- A **Recent Activities** list (actor · summary · relative time). Reuse the `timeAgo` formatter pattern from `src/app/(portal)/page.tsx`.

- [ ] **Step 3: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Manual: `/superadmin` shows correct counts and the org tree (SBNU with SPS/WIE/CS/… under it).

- [ ] **Step 4: Commit**

```bash
git add src/app/superadmin/queries.ts src/app/superadmin/page.tsx
git commit -m "feat: super admin dashboard with stats, org tree, recent activity"
```

---

### Task 3: Organizations — list, detail tabs, create/edit

**Files:**
- Create: `src/app/superadmin/organizations/page.tsx`
- Create: `src/app/superadmin/organizations/[branchId]/page.tsx`
- Create: `src/app/superadmin/organizations/create-org-dialog.tsx` (client)
- Modify: `src/app/superadmin/queries.ts` (add branch-detail helpers)
- Modify: `src/app/superadmin/actions.ts` (add branch actions)

**Interfaces:**
- Produces (queries):
  - `type MemberRow = { membership_id: string; profile_id: string; full_name: string; email: string; position_name: string | null }`
  - `getBranchDetail(branchId: string): Promise<{ id: string; name: string; slug: string; description: string | null; parent_id: string | null; parentName: string | null } | null>`
  - `getBranchMembers(branchId: string): Promise<MemberRow[]>`
  - `getBranchPositions(branchId: string): Promise<{ id: string; name: string }[]>`
- Produces (actions):
  - `createOrganization(formData: FormData): Promise<{ success?: boolean; error?: string }>` (fields: `name`, `slug`, `description`)
  - `createSubBranch(formData: FormData)` (fields: `parent_id`, `name`, `slug`, `description`)
  - `updateBranch(formData: FormData)` (fields: `id`, `name`, `slug`, `description`)

- [ ] **Step 1: Add branch query helpers**

Append to `src/app/superadmin/queries.ts`:
```ts
export type MemberRow = {
  membership_id: string; profile_id: string; full_name: string; email: string; position_name: string | null
}

export async function getBranchDetail(branchId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('branches').select('id, name, slug, description, parent_id, parent:branches!parent_id(name)')
    .eq('id', branchId).single()
  if (!data) return null
  return { ...data, parentName: (data.parent as any)?.name ?? null }
}

export async function getBranchMembers(branchId: string): Promise<MemberRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('memberships')
    .select('id, profile_id, profiles(full_name, email), positions(name)')
    .eq('branch_id', branchId).is('ended_at', null)
  return (data ?? []).map((m) => ({
    membership_id: m.id,
    profile_id: m.profile_id,
    full_name: (m.profiles as any)?.full_name ?? '',
    email: (m.profiles as any)?.email ?? '',
    position_name: (m.positions as any)?.name ?? null,
  }))
}

export async function getBranchPositions(branchId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('positions').select('id, name').eq('branch_id', branchId).order('name')
  return data ?? []
}
```

- [ ] **Step 2: Add branch actions**

Append to `src/app/superadmin/actions.ts` (reuse the `requireSuperAdmin()` helper defined in Phase 1 Task 9):
```ts
import { revalidatePath } from 'next/cache'

export async function createOrganization(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  if (!name || !slug) return { error: 'Name and slug are required' }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('branches').insert({ name, slug, description, parent_id: null }).select('id').single()
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'org_created', entityType: 'organization',
    entityId: data.id, branchId: data.id, summary: `Created organization "${name}"`, details: { slug },
  })
  revalidatePath('/superadmin/organizations')
  return { success: true }
}

export async function createSubBranch(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const parent_id = String(formData.get('parent_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  if (!parent_id || !name || !slug) return { error: 'Parent, name, and slug are required' }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('branches').insert({ name, slug, description, parent_id }).select('id').single()
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'branch_created', entityType: 'branch',
    entityId: data.id, branchId: data.id, summary: `Created branch "${name}"`, details: { parent_id, slug },
  })
  revalidatePath('/superadmin/organizations')
  return { success: true }
}

export async function updateBranch(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  if (!id || !name || !slug) return { error: 'Name and slug are required' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('branches').update({ name, slug, description }).eq('id', id)
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'branch_updated', entityType: 'branch',
    entityId: id, branchId: id, summary: `Updated "${name}"`, details: { slug },
  })
  revalidatePath(`/superadmin/organizations/${id}`)
  revalidatePath('/superadmin/organizations')
  return { success: true }
}
```

- [ ] **Step 3: Build the list page**

`src/app/superadmin/organizations/page.tsx` — server component. Load `getOrganizationTree()`; render the tree (orgs → branches → sub-branches), each linking to `/superadmin/organizations/[id]`. Include a "Create Organization" button opening `create-org-dialog.tsx`.

- [ ] **Step 4: Build the create/edit dialog (client)**

`src/app/superadmin/organizations/create-org-dialog.tsx` — `'use client'`. A `Dialog` (from `@/components/ui/dialog`) with a form (`name`, `slug`, `description`) posting via `useActionState` to `createOrganization` (or `createSubBranch` when a `parentId` prop is passed). On success, `toast.success` + `router.refresh()`. Follow the form/action pattern in `src/app/sudo/page.tsx` (now deleted — use `src/app/(portal)/pre-approved` client component as the live reference instead).

- [ ] **Step 5: Build the detail page with tabs**

`src/app/superadmin/organizations/[branchId]/page.tsx` — server component. Load `getBranchDetail`, `getBranchMembers`, `getBranchPositions`. Use `Tabs` (`@/components/ui/tabs`):
- **Overview:** name, slug, description, parent; "Edit" (reuses the dialog in edit mode), "Create Sub-Branch".
- **Executive Committee / Associate Members:** `classifyMembers(members)` from `@/utils/positions`; render each as a table (name · email · position) with an **Open Workspace** button (`<form action={openWorkspace.bind(null, m.membership_id)}>`).
- **Positions:** list `getBranchPositions`; link to `/superadmin/positions` for management.
- **Users:** full member table with per-row **Open Workspace** and a link to `/superadmin/users/[profile_id]`.

- [ ] **Step 6: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Manual: open an org → tabs populate; create a sub-branch → appears in the tree and `audit_log`; Open Workspace from a member row enters impersonation.

- [ ] **Step 7: Commit**

```bash
git add src/app/superadmin/organizations src/app/superadmin/queries.ts src/app/superadmin/actions.ts
git commit -m "feat: organizations module (list, detail tabs, create/edit)"
```

---

### Task 4: Users — list/search, detail, assign/remove/permissions

**Files:**
- Create: `src/app/superadmin/users/page.tsx`
- Create: `src/app/superadmin/users/[profileId]/page.tsx`
- Create: `src/app/superadmin/users/user-actions.tsx` (client island for the mutation controls)
- Modify: `src/app/superadmin/queries.ts`
- Modify: `src/app/superadmin/actions.ts`

**Interfaces:**
- Produces (queries):
  - `type UserRow = { id: string; full_name: string; email: string; ieee_membership_id: string | null; status: string }`
  - `listUsers(opts: { search?: string; status?: string; page?: number; pageSize?: number }): Promise<{ rows: UserRow[]; total: number }>`
  - `getUserAdminDetail(profileId): Promise<{ profile: {...}; memberships: {...}[]; grants: {...}[] } | null>`
  - `getAllPermissions(): Promise<{ id: string; name: string; description: string | null }[]>`
- Produces (actions):
  - `assignPosition(formData)` (fields: `profile_id`, `branch_id`, `position_id`, `reason?`)
  - `removePosition(formData)` (fields: `membership_id`)
  - `grantPermission(formData)` (fields: `profile_id`, `branch_id`, `permission_id`)
  - `revokePermission(formData)` (fields: `member_permission_id`)

- [ ] **Step 1: Add user query helpers**

Append to `src/app/superadmin/queries.ts`:
```ts
export type UserRow = { id: string; full_name: string; email: string; ieee_membership_id: string | null; status: string }

export async function listUsers(opts: { search?: string; status?: string; page?: number; pageSize?: number }) {
  const supabase = createAdminClient()
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 25
  const from = (page - 1) * pageSize
  let q = supabase.from('profiles').select('id, full_name, email, ieee_membership_id, status', { count: 'exact' })
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.search) {
    const s = `%${opts.search}%`
    q = q.or(`full_name.ilike.${s},email.ilike.${s},ieee_membership_id.ilike.${s}`)
  }
  const { data, count } = await q.order('full_name').range(from, from + pageSize - 1)
  return { rows: (data ?? []) as UserRow[], total: count ?? 0 }
}

export async function getUserAdminDetail(profileId: string) {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, ieee_membership_id, phone, section, status, bio, skills, created_at')
    .eq('id', profileId).single()
  if (!profile) return null
  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, branch_id, position_id, ended_at, branches(name), positions(name)')
    .eq('profile_id', profileId).order('assigned_at', { ascending: false })
  const { data: grants } = await supabase
    .from('member_permissions')
    .select('id, branch_id, revoked_at, branches(name), permissions(name)')
    .eq('profile_id', profileId).is('revoked_at', null)
  return { profile, memberships: memberships ?? [], grants: grants ?? [] }
}

export async function getAllPermissions() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('permissions').select('id, name, description').order('name')
  return data ?? []
}
```

- [ ] **Step 2: Add user actions**

Append to `src/app/superadmin/actions.ts`:
```ts
export async function assignPosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const profile_id = String(formData.get('profile_id') ?? '')
  const branch_id = String(formData.get('branch_id') ?? '')
  const position_id = String(formData.get('position_id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim() || 'Assigned by super admin'
  if (!profile_id || !branch_id || !position_id) return { error: 'Profile, branch, and position are required' }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('memberships')
    .insert({ profile_id, branch_id, position_id, assigned_by: session.user!.id, reason })
    .select('id').single()
  if (error) return { error: error.message }
  await supabase.from('membership_audit_log').insert({
    profile_id, branch_id, action: 'role_assigned', changed_by: session.user!.id,
    details: { position_id, reason, via: 'super_admin' },
  })
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_assigned', entityType: 'membership',
    entityId: data.id, branchId: branch_id, summary: `Assigned a position to a user`,
    details: { profile_id, position_id },
  })
  revalidatePath(`/superadmin/users/${profile_id}`)
  return { success: true }
}

export async function removePosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const membership_id = String(formData.get('membership_id') ?? '')
  if (!membership_id) return { error: 'Membership required' }

  const supabase = createAdminClient()
  const { data: m } = await supabase.from('memberships')
    .select('profile_id, branch_id, position_id').eq('id', membership_id).single()
  const { error } = await supabase.from('memberships')
    .update({ ended_at: new Date().toISOString() }).eq('id', membership_id).is('ended_at', null)
  if (error) return { error: error.message }
  if (m) {
    await supabase.from('membership_audit_log').insert({
      profile_id: m.profile_id, branch_id: m.branch_id, action: 'role_revoked',
      changed_by: session.user!.id, details: { position_id: m.position_id, via: 'super_admin' },
    })
    await logAdminAction({
      actorProfileId: session.user!.id, action: 'position_removed', entityType: 'membership',
      entityId: membership_id, branchId: m.branch_id, summary: `Removed a user's position`,
      details: { profile_id: m.profile_id },
    })
    revalidatePath(`/superadmin/users/${m.profile_id}`)
  }
  return { success: true }
}

export async function grantPermission(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const profile_id = String(formData.get('profile_id') ?? '')
  const branch_id = String(formData.get('branch_id') ?? '')
  const permission_id = String(formData.get('permission_id') ?? '')
  if (!profile_id || !branch_id || !permission_id) return { error: 'All fields required' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('member_permissions')
    .insert({ profile_id, branch_id, permission_id, granted_by: session.user!.id })
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'permission_granted', entityType: 'permission',
    entityId: permission_id, branchId: branch_id, summary: `Granted a permission to a user`,
    details: { profile_id, permission_id },
  })
  revalidatePath(`/superadmin/users/${profile_id}`)
  return { success: true }
}

export async function revokePermission(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const member_permission_id = String(formData.get('member_permission_id') ?? '')
  if (!member_permission_id) return { error: 'Grant id required' }

  const supabase = createAdminClient()
  const { data: mp } = await supabase.from('member_permissions')
    .select('profile_id, branch_id, permission_id').eq('id', member_permission_id).single()
  const { error } = await supabase.from('member_permissions')
    .update({ revoked_at: new Date().toISOString() }).eq('id', member_permission_id).is('revoked_at', null)
  if (error) return { error: error.message }
  if (mp) {
    await logAdminAction({
      actorProfileId: session.user!.id, action: 'permission_revoked', entityType: 'permission',
      entityId: mp.permission_id, branchId: mp.branch_id, summary: `Revoked a permission`,
      details: { profile_id: mp.profile_id },
    })
    revalidatePath(`/superadmin/users/${mp.profile_id}`)
  }
  return { success: true }
}
```

- [ ] **Step 3: Build the users list page**

`src/app/superadmin/users/page.tsx` — server component reading `searchParams` (`?q=&status=&page=`). Call `listUsers({ search, status, page })`. Render a search form (GET), a status filter (`Select`), a `Table` (name · email · IEEE ID · status), each row linking to `/superadmin/users/[id]`, and simple prev/next pagination using `total`.

- [ ] **Step 4: Build the user detail page + controls**

`src/app/superadmin/users/[profileId]/page.tsx` — server component. Load `getUserAdminDetail`, `getAllBranches` (from `@/lib/queries`), `getPositionsForBranch` is per-branch (fetched client-side or pass all positions), `getAllPermissions`. Render profile summary; active positions (each with **Remove** via `removePosition` and **Open Workspace** via `openWorkspace`); position history (ended memberships, read-only); direct grants (each with **Revoke**); and the `user-actions.tsx` island for **Assign position** (branch + position selects) and **Grant permission** (branch + permission selects), plus a **disabled** "Reset Password (coming soon)" button.

`src/app/superadmin/users/user-actions.tsx` — `'use client'`. Contains the assign-position and grant-permission forms wired to the actions via `useActionState`, with `toast` + `router.refresh()` on success. Position options depend on the chosen branch — either fetch positions per branch through a small server action or pass a `positionsByBranch` map as a prop from the server page.

- [ ] **Step 5: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Manual: search finds users; open a user → assign a position (appears + `audit_log` + `membership_audit_log` rows), remove it, grant/revoke a permission, Open Workspace works, Reset Password is disabled.

- [ ] **Step 6: Commit**

```bash
git add src/app/superadmin/users src/app/superadmin/queries.ts src/app/superadmin/actions.ts
git commit -m "feat: users module (search, detail, assign/remove positions and permissions)"
```

---

### Task 5: Positions — global list + CRUD + permission mapping

**Files:**
- Create: `src/app/superadmin/positions/page.tsx`
- Create: `src/app/superadmin/positions/position-controls.tsx` (client)
- Modify: `src/app/superadmin/queries.ts`
- Modify: `src/app/superadmin/actions.ts`

**Interfaces:**
- Produces (queries):
  - `type PositionGroup = { branchId: string; branchName: string; positions: { id: string; name: string; permissionIds: string[] }[] }`
  - `listPositionsGrouped(): Promise<PositionGroup[]>`
- Produces (actions):
  - `createPosition(formData)` (fields: `branch_id`, `name`)
  - `updatePosition(formData)` (fields: `id`, `name`)
  - `deletePosition(formData)` (fields: `id`)
  - `setPositionPermissions(formData)` (fields: `position_id`, `permission_ids` — repeated form values)

- [ ] **Step 1: Add the grouped-positions query**

Append to `src/app/superadmin/queries.ts`:
```ts
export type PositionGroup = {
  branchId: string; branchName: string
  positions: { id: string; name: string; permissionIds: string[] }[]
}

export async function listPositionsGrouped(): Promise<PositionGroup[]> {
  const supabase = createAdminClient()
  const { data: positions } = await supabase
    .from('positions').select('id, name, branch_id, branches(name)').order('name')
  const { data: pp } = await supabase.from('position_permissions').select('position_id, permission_id')

  const permsByPosition = new Map<string, string[]>()
  for (const row of pp ?? []) {
    const arr = permsByPosition.get(row.position_id) ?? []
    arr.push(row.permission_id)
    permsByPosition.set(row.position_id, arr)
  }
  const groups = new Map<string, PositionGroup>()
  for (const p of positions ?? []) {
    const g = groups.get(p.branch_id) ?? {
      branchId: p.branch_id, branchName: (p.branches as any)?.name ?? '', positions: [],
    }
    g.positions.push({ id: p.id, name: p.name, permissionIds: permsByPosition.get(p.id) ?? [] })
    groups.set(p.branch_id, g)
  }
  return [...groups.values()].sort((a, b) => a.branchName.localeCompare(b.branchName))
}
```

- [ ] **Step 2: Add position actions**

Append to `src/app/superadmin/actions.ts`:
```ts
export async function createPosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const branch_id = String(formData.get('branch_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!branch_id || !name) return { error: 'Branch and name are required' }
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('positions').insert({ branch_id, name }).select('id').single()
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_created', entityType: 'position',
    entityId: data.id, branchId: branch_id, summary: `Created position "${name}"`, details: null,
  })
  revalidatePath('/superadmin/positions')
  return { success: true }
}

export async function updatePosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!id || !name) return { error: 'Name required' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('positions').update({ name }).eq('id', id)
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_updated', entityType: 'position',
    entityId: id, summary: `Renamed a position to "${name}"`, details: null,
  })
  revalidatePath('/superadmin/positions')
  return { success: true }
}

export async function deletePosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Position required' }
  const supabase = createAdminClient()
  // Block delete if any active membership uses it.
  const { count } = await supabase.from('memberships')
    .select('id', { count: 'exact', head: true }).eq('position_id', id).is('ended_at', null)
  if ((count ?? 0) > 0) return { error: 'Position is held by active members; remove them first.' }
  const { error } = await supabase.from('positions').delete().eq('id', id)
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_deleted', entityType: 'position',
    entityId: id, summary: `Deleted a position`, details: null,
  })
  revalidatePath('/superadmin/positions')
  return { success: true }
}

export async function setPositionPermissions(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const position_id = String(formData.get('position_id') ?? '')
  const permission_ids = formData.getAll('permission_ids').map(String)
  if (!position_id) return { error: 'Position required' }
  const supabase = createAdminClient()
  await supabase.from('position_permissions').delete().eq('position_id', position_id)
  if (permission_ids.length > 0) {
    await supabase.from('position_permissions')
      .insert(permission_ids.map((permission_id) => ({ position_id, permission_id })))
  }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_permissions_set', entityType: 'position',
    entityId: position_id, summary: `Updated position permissions`, details: { count: permission_ids.length },
  })
  revalidatePath('/superadmin/positions')
  return { success: true }
}
```

- [ ] **Step 3: Build the positions page + controls**

`src/app/superadmin/positions/page.tsx` — server component. Load `listPositionsGrouped()`, `getAllBranches()`, `getAllPermissions()`. Render each branch group with its positions; per position show its permissions as `Badge`s and an "Edit permissions" control. Include a "Create Position" form (branch select + name).

`src/app/superadmin/positions/position-controls.tsx` — `'use client'`. Add `checkbox` primitive first: `npx shadcn@latest add checkbox`. Render the create-position form, per-position rename/delete, and a permissions editor (checkbox list of all permissions, pre-checked from `permissionIds`, submitting `permission_ids` to `setPositionPermissions`). Wire via `useActionState` + `toast` + `router.refresh()`.

- [ ] **Step 4: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Manual: create/rename a position; toggle its permissions (persist + `audit_log`); delete is blocked when members hold it.

- [ ] **Step 5: Commit**

```bash
git add src/app/superadmin/positions src/app/superadmin/queries.ts src/app/superadmin/actions.ts components.json src/components/ui/checkbox.tsx
git commit -m "feat: positions module (CRUD + permission mapping)"
```

---

### Task 6: Position Requests — all-branch queue + history

**Files:**
- Create: `src/app/superadmin/position-requests/page.tsx`
- Create: `src/app/superadmin/position-requests/request-controls.tsx` (client)

**Interfaces:**
- Consumes: `getPendingPositionRequests()` from `@/lib/queries` (already all-branch); `approvePositionRequest` / `rejectPositionRequest` from `@/app/(portal)/position-requests/actions` (already pass for `['*']`).

- [ ] **Step 1: Extend the existing approve/reject actions to write `audit_log`**

In `src/app/(portal)/position-requests/actions.ts`, at the end of `approvePositionRequest` and `rejectPositionRequest` (after their existing `membership_audit_log`/notification writes, on success), add a `logAdminAction` call **only when the actor is a super admin**:
```ts
const session = await auth()
if (session?.isSuperAdmin) {
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_request_approved', // or _rejected
    entityType: 'membership', entityId: requestId, summary: `Decided a position request`, details: null,
  })
}
```
(Import `logAdminAction`; `auth` is already imported.)

- [ ] **Step 2: Build the page**

`src/app/superadmin/position-requests/page.tsx` — server component. Load `getPendingPositionRequests()`. Render the pending queue (requester · branch · requested position · reason) with **Approve** / **Reject** controls in `request-controls.tsx` (client, `useActionState` → the existing actions). Below, show recent decided requests (query `position_requests` with status in `approved`/`rejected`, limit 25) as read-only history.

- [ ] **Step 3: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Manual: approve a request → membership created, request marked approved, `audit_log` + `membership_audit_log` rows appear.

- [ ] **Step 4: Commit**

```bash
git add src/app/superadmin/position-requests src/app/\(portal\)/position-requests/actions.ts
git commit -m "feat: super admin position requests queue with audit"
```

---

### Task 7: Audit Logs — unified feed

**Files:**
- Create: `src/app/superadmin/audit/page.tsx`
- Modify: `src/app/superadmin/queries.ts`

**Interfaces:**
- Produces:
  - `type AuditEntry = { id: string; actor: string; action: string; entityType: string; summary: string; branchName: string | null; created_at: string; source: 'audit' | 'event' | 'membership' }`
  - `getAuditLog(opts: { source?: 'audit' | 'event' | 'membership'; actorId?: string; page?: number; pageSize?: number }): Promise<{ rows: AuditEntry[]; total: number }>`

- [ ] **Step 1: Add the unified reader**

Append to `src/app/superadmin/queries.ts`:
```ts
export type AuditEntry = {
  id: string; actor: string; action: string; entityType: string
  summary: string; branchName: string | null; created_at: string
  source: 'audit' | 'event' | 'membership'
}

export async function getAuditLog(opts: {
  source?: 'audit' | 'event' | 'membership'; actorId?: string; page?: number; pageSize?: number
}): Promise<{ rows: AuditEntry[]; total: number }> {
  const supabase = createAdminClient()
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 50
  const from = (page - 1) * pageSize

  // Primary source: audit_log (super-admin/structural actions).
  let q = supabase
    .from('audit_log')
    .select('id, action, entity_type, summary, created_at, branch_id, branches(name), profiles!audit_log_actor_profile_id_fkey(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (opts.actorId) q = q.eq('actor_profile_id', opts.actorId)
  const { data, count } = await q.range(from, from + pageSize - 1)

  const rows: AuditEntry[] = (data ?? []).map((r) => ({
    id: r.id, actor: (r.profiles as any)?.full_name ?? 'Unknown', action: r.action,
    entityType: r.entity_type, summary: r.summary, branchName: (r.branches as any)?.name ?? null,
    created_at: r.created_at, source: 'audit',
  }))
  return { rows, total: count ?? 0 }
}
```
> **Note:** Phase-1 scope for the Audit page is the `audit_log` source with actor + pagination filters. Merging `event_audit_log` / `membership_audit_log` into the same feed is a straightforward follow-up (union the mapped rows, sort by `created_at`); implement it here if time allows, otherwise leave the `source` param wired for the extension.

- [ ] **Step 2: Build the page**

`src/app/superadmin/audit/page.tsx` — server component reading `searchParams` (`?page=`). Call `getAuditLog({ page })`. Render a `Table` (time · actor · action · entity · branch · summary) with prev/next pagination. Reuse the `timeAgo` formatter.

- [ ] **Step 3: Verify build + lint + manual**

Run: `npm run build && npm run lint`
Manual: prior actions (org created, position assigned, workspace opened, etc.) appear newest-first.

- [ ] **Step 4: Commit**

```bash
git add src/app/superadmin/audit src/app/superadmin/queries.ts
git commit -m "feat: unified audit log page"
```

---

### Task 8: Settings

**Files:**
- Create: `src/app/superadmin/settings/page.tsx`

**Interfaces:**
- Consumes: `auth()`, `getSuperAdminStats` (optional, for a roster count via a small direct count of `superadmins`).

- [ ] **Step 1: Build the settings page**

`src/app/superadmin/settings/page.tsx` — server component. Show: current session (name, email), theme note (the toggle lives in the top bar), a read-only **Super Admin roster** card showing the count from `superadmins` (`select id, count exact, head`) with copy: "Managed via database migration; emails are stored hashed." Add disabled placeholder controls for future policy (password-reset, session length) with "Coming soon" labels.

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/superadmin/settings
git commit -m "feat: super admin settings page"
```

---

### Task 9: Final verification & docs

**Files:**
- Modify: `docs/SCHEMA.md` (document `audit_log`; remove stale `is_super_admin` references)
- Modify: `README.md` (add migration `00008` to the history table)

- [ ] **Step 1: Full gate run**

Run: `npm run build && npm run lint && npm test`
Expected: all pass. Grep confirms no stale refs: `grep -rn "isSudoMode\|is_super_admin" src` → empty.

- [ ] **Step 2: End-to-end manual walkthrough**

As a super admin (`npm run dev`): login → auto-lands on `/superadmin`; dashboard counts correct; open an org → tabs; create sub-branch; search a user → assign/remove position, grant/revoke permission; positions CRUD + permission toggles; approve a position request; open a workspace (banner + member view) → exit; audit page shows every action attributed to you. As a non-super-admin: `/superadmin` redirects to `/`, and no super-admin UI is visible anywhere.

- [ ] **Step 3: Update docs**

Add an `audit_log` section to `docs/SCHEMA.md`, remove the stale `is_super_admin` column/query references, and add migration `00008_audit_log.sql` to the README migration history.

- [ ] **Step 4: Commit**

```bash
git add docs/SCHEMA.md README.md
git commit -m "docs: document audit_log and remove stale is_super_admin references"
```

---

## Phase 2 Self-Review

- **Spec coverage (§9):** Dashboard → Task 2; Organizations → Task 3; Users → Task 4; Positions → Task 5; Position Requests → Task 6; Audit Logs → Task 7; Settings → Task 8. Exec/Associate rule (§7) → Task 1, used in Task 3. Docs cleanup (§5.4) → Task 9. ✅
- **Deferred items honored:** Documents/Tasks/Teams tabs omitted (not stubbed); Reset Password disabled; branch deletion excluded; position deletion guarded against active members. ✅
- **Type consistency:** `MemberRow`, `UserRow`, `PositionGroup`, `OrgNode`, `ActivityItem`, `AuditEntry` defined once in `queries.ts` and reused; action field names match the form fields listed in each Interfaces block. ✅
- **Known follow-ups (flagged, not silent):** merging the two legacy audit tables into the unified feed (Task 7 note); verifying the `audit_log` → `profiles` FK embed name (Task 2 note).
