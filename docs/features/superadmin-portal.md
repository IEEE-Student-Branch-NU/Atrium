# Feature: Super-Admin Portal (`/superadmin`)

> The global control plane. A super-admin manages every branch, user, position, permission, notification, and audit record from here. See [../AUTH.md](../AUTH.md) for how super-admin identity works and [impersonation.md](impersonation.md) for "Open Workspace".
> **Historical design:** [../superpowers/specs/2026-07-08-super-admin-portal-design.md](../superpowers/specs/2026-07-08-super-admin-portal-design.md)

---

## Access gating (three layers)

1. **Edge middleware** (`src/utils/supabase/middleware.ts`) — `/superadmin/login` is public; any other `/superadmin*` requires `session.isSuperAdmin`. Unauthenticated → `/superadmin/login`; non-super-admin → `/`. A signed-in super-admin visiting `/`, `/login`, `/signup`, `/superadmin/login` is bounced to `/superadmin` (unless impersonating).
2. **Server layout** (`src/app/superadmin/(dashboard)/layout.tsx`) — `redirect('/')` if `!session.isSuperAdmin`. The login page lives **outside** the `(dashboard)` group so it isn't gated.
3. **Per-action guard** — every action calls `requireSuperAdmin()`, returning `{ error: 'Not authorized' }` otherwise.

> The sidebar (`src/components/superadmin/sidebar.tsx`) shows **every** item to every super-admin — no per-item permission gating (unlike the member sidebar).

## Pages

| Route | File | What it does |
|-------|------|--------------|
| `/superadmin` | `(dashboard)/page.tsx` | Home: 6 stat cards (`getSuperAdminStats`), recursive org tree (`getOrganizationTree`), recent activity nav-card (`getRecentActivityFeed`), broadcast dialog. Recent Activity is a **nav card, not a count** — the count saturates at the query limit, which would mislead. |
| `/superadmin/organizations` | `organizations/page.tsx` + `create-org-dialog.tsx` | Branch tree + create org. |
| `/superadmin/organizations/[branchId]` | `.../[branchId]/page.tsx` | Branch detail: tabs (Overview / Executive / Associates / Positions / Users); edit branch + add sub-branch; per-member Open Workspace. |
| `/superadmin/users` | `users/page.tsx` | Paginated user search (`listUsers`) + per-user **Open workspace** menu (batched `getActiveMembershipsForProfiles`). |
| `/superadmin/users/[profileId]` | `.../[profileId]/page.tsx` + `user-actions.tsx` | User detail: profile, active positions (assign/remove, Open Workspace), position history, direct permission grants (grant/revoke). |
| `/superadmin/positions` | `positions/page.tsx` + `position-controls.tsx` | Positions grouped by branch; create/rename/delete; set permissions. |
| `/superadmin/position-requests` | `position-requests/page.tsx` + `request-controls.tsx` | Pending queue (all branches) + recently-decided history. Reuses the portal approve/reject actions. |
| `/superadmin/notifications` | `notifications/page.tsx` + `send-notification-dialog.tsx` | Oversight feed of **all** notifications + unified send (user / branch Chairs / everyone). See [notifications.md](notifications.md). |
| `/superadmin/audit` | `audit/page.tsx` | Paginated `audit_log` (super-admin/structural actions). |
| `/superadmin/settings` | `settings/page.tsx` | Session info, super-admin roster count, theme; two "coming soon" controls. |

## Server actions (`src/app/superadmin/actions.ts`)

All `'use server'`, guarded by `requireSuperAdmin()`, return `{ success }` | `{ error }` (except the two that redirect). Every structural action writes `audit_log` via `logAdminAction`.

| Action | Effect | Audit | Notifies |
|--------|--------|-------|----------|
| `openWorkspace` / `exitWorkspace` | Start/stop [impersonation](impersonation.md) (redirect) | `workspace_opened` | — |
| `createOrganization` / `createSubBranch` / `updateBranch` | Branch CRUD | `org_created` / `branch_created` / `branch_updated` | — |
| `assignPosition` | Insert membership | `position_assigned` | **`member.promoted`** (✉️) |
| `removePosition` | End membership (`ended_at`) | `position_removed` | **`member.position_removed`** |
| `grantPermission` / `revokePermission` | Direct grants | `permission_granted` / `_revoked` | **`permission.granted` / `.revoked`** |
| `createPosition` / `updatePosition` / `deletePosition` | Position CRUD | `position_created` / `_updated` / `_deleted` | — |
| `setPositionPermissions` | Replace a position's permissions | `position_permissions_set` | — |
| `sendBroadcastMessage` | Legacy broadcast | `broadcast_sent` | **`notifyBroadcast`** |
| `sendNotification` | Unified send (user/branch/broadcast) | `notification_sent` | **`notifyCustom`/`notifyBroadcast`** |

## Key decisions & rationale

- **`isSuperAdmin` is the only gate** for the console — branch permissions don't apply here. This is why actions operate on the *target's* branch/position, not the admin's.
- **All structural actions are audited** through one best-effort helper (`logAdminAction`) so a failed audit never blocks the action.
- **Notifications on structural changes** — assigning a position or granting a permission now tells the affected member (added when the notification system landed).
- **Reads degrade gracefully** — `getAllNotifications` and `getAuditLog` wrap their queries in try/catch and return empty if migration `00011`/`00008` isn't applied yet, so the pages render instead of crashing.

## Gotchas (things that will bite you)

- **`setPositionPermissions` is non-atomic** (delete-then-insert across two REST calls). If the insert fails, the position is left with **zero** permissions; an admin retry fixes it. True atomicity would need a Postgres RPC.
- **`deletePosition` counts ALL memberships** (active *and* ended) because `memberships.position_id` is FK `RESTRICT` — a position that was ever assigned can't be deleted. Fails closed on a count error.
- **Form-action adapters:** actions returning `{ error }` can't be used directly as a `<form action>` (must resolve to `void`), so pages wrap them in inline `'use server'` adapters (`openWorkspaceAction`, `removePositionAction`, …). Copy this pattern.
- **`deletePosition` uses a native `confirm()`** (invoked directly, not via `<form action>`) because there's no blocking-confirm component in the UI kit.
- **Disabled pagination** renders a plain disabled `Button`, not a disabled `Link` — a disabled anchor still navigates.
- **The top bar always says "Dashboard"** — the layout renders `SuperAdminTopBar` without a `title` prop (its default). Cosmetic.
- **The audit page reads `audit_log` only** (Phase-1). Merging `event_audit_log`/`membership_audit_log` is wired (`source` param) but not implemented.

## How to extend

- **New console page:** add a route under `(dashboard)/`, a query in `superadmin/queries.ts`, a nav item in `sidebar.tsx`, and (for mutations) an action in `actions.ts` guarded by `requireSuperAdmin()` + `logAdminAction`.
- **New structural mutation:** follow any existing action — guard, mutate via `createAdminClient()`, `logAdminAction`, optionally `notifyUser`, `revalidatePath`.
