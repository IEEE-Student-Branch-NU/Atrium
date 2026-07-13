# Atrium — Permissions, Positions & Membership Model

> The authorization model. Read this with [AUTH.md](AUTH.md) (who you are) and [SCHEMA.md](SCHEMA.md) (where it's stored).
> **Last Updated:** July 2026

Atrium deliberately has **no "role" column**. Access is computed from three composable pieces — **positions**, **permissions**, and **memberships** — plus a super-admin bypass. This document explains the model, the resolution algorithm, and how to change it.

---

## 1. The mental model

```
profile ──(membership)──▶ branch
              │
              └─▶ position ──(position_permissions)──▶ permissions
              
profile ──(member_permissions, branch-scoped)──▶ permissions   ← direct ad-hoc grants
```

- A **membership** ties a `profile` to a `branch`, optionally with a `position`. It is the unit of "belonging". A user can hold **several** active memberships (e.g. Priyansh: *MDO* and *Technical Associate*).
- A **position** (Chair, MDO, Technical Head…) is branch-scoped and maps to a set of **permissions** via `position_permissions`.
- **Direct grants** (`member_permissions`) hand a specific permission to a specific person in a specific branch, independent of any position.
- **Super-admin** is a global bypass that resolves to the `*` wildcard (all permissions) — see [AUTH.md](AUTH.md).

There is intentionally no `admin`/`member` enum: "admin power" is always "holds permission X in branch Y". The original `portal_role` enum was dropped in migration `00002`.

---

## 2. The nine permissions

Seeded in `00002_permission_system.sql`. The TypeScript union lives in `src/utils/auth/permissions.ts` (`PermissionName`).

| Permission | Gates |
|-----------|-------|
| `create_events` | Create event drafts in a branch |
| `approve_events` | Approve or reject pending events |
| `manage_events` | Edit or delete any event in the branch |
| `manage_members` | Assign positions and grant permissions to members |
| `approve_registrations` | Approve or reject new member signups |
| `view_members` | View the member directory and role history |
| `view_audit_log` | Access the audit trail |
| `manage_event_types` | Add or edit event categories |
| `manage_positions` | Create custom positions / decide position requests |

> Adding a permission means: (1) insert a row in `permissions` via a migration, (2) add it to the `PermissionName` union in `permissions.ts`, (3) map it to positions (`position_permissions`) and/or gate UI/actions on it.

---

## 3. Default position → permission matrix

Seeded across all branches in `00002` (and `00005` for the later positions). `Chair` gets **every** permission.

| Position | Permissions |
|----------|-------------|
| **Chair** | *all nine* (full branch control) — also the position that grants **branch-activity notification** visibility (see [features/notifications.md](features/notifications.md)) |
| **Vice Chair** | create/approve/manage events, manage_members, approve_registrations, view_members, view_audit_log (all except `manage_positions`) |
| **General Secretary** | create_events, view_members, view_audit_log |
| **Technical Head** | create_events, view_members |
| **Creative Head** | create_events, view_members |
| **MDO** | approve_registrations, view_members |
| **Web Master** | view_members, create_events |
| **Treasurer** | view_members, create_events |
| **Technical Associate** | view_members |
| **Marketing Associate** | view_members |

These are **defaults at seed time**. A super-admin can re-map any position's permissions at `/superadmin/positions` (`setPositionPermissions`), which rewrites `position_permissions` for that position.

---

## 4. How permissions are resolved

`getUserPermissions(supabase, profileId, branchId, membershipId?)` in `src/utils/auth/permissions.ts`:

1. **Super-admin bypass** — if `session.isSuperAdmin`, return `['*']` immediately. No DB reads.
2. **Position-based** — for the given membership's `position_id`, collect its `position_permissions`. (If a `membershipId` is passed, **only that workspace's** position counts; the legacy fallback with no membershipId scans all active memberships in the branch.)
3. **Direct grants** — add active `member_permissions` (`revoked_at IS NULL`) for that `profile_id` + `branch_id`.
4. **Deduplicate** and return `string[]`.

Then:
- `hasPermission(perms, 'x')` → `perms.includes('*') || perms.includes('x')`.
- `checkPermission(...)` → convenience wrapper doing resolve + check.
- `canApproveRegistrations(supabase, profileId)` → special "any branch" check (the registration queue isn't scoped to one branch); super-admin short-circuits to `true`.

### The single most important rule: **permissions are workspace-scoped and never merged across branches**

> From `permissions.ts`: *"Permissions are NEVER merged across workspaces. Each workspace is independent."*

If you are Chair of CS and a plain Member of ITSS, your permissions **while acting in the ITSS workspace** are just a member's. Switching workspace (the sidebar [RoleSwitcher](features/workspace-switching.md)) changes which membership — and therefore which permission set — is active. The active workspace is a cookie (`atrium_workspace_id`) resolved in the portal layout.

---

## 5. Where permissions are enforced

- **Portal layout** (`src/app/(portal)/layout.tsx`) resolves the active workspace's permissions once and passes them to the sidebar.
- **Sidebar nav** (`src/components/portal/sidebar.tsx`) hides items the user can't use via `canSee(permissions, item.permission)` — e.g. "Registrations" needs `approve_registrations`, "Position Requests" needs `manage_positions`.
- **Server actions** re-check on every mutation — the UI gate is cosmetic; the action is the real boundary. Example: `approveRegistration` re-runs `getUserPermissions` + `hasPermission('approve_registrations')` and throws if missing.
- **Super-admin console** (`/superadmin/**`) is gated separately by `session.isSuperAdmin` (middleware + `requireSuperAdmin()`), not by these branch permissions.

> **Gotcha:** never rely on the sidebar hiding a link for security. Always re-check permission inside the server action. Every existing action already does this — follow the pattern.

---

## 6. How to make common changes

| Goal | How |
|------|-----|
| Give a person a one-off permission in a branch | Super-admin → Users → open the user → **Grant permission** (`grantPermission` → `member_permissions`). Revoke sets `revoked_at`. |
| Change what a position can do everywhere | Super-admin → Positions → edit permissions (`setPositionPermissions`). Affects all holders of that position. |
| Make someone a branch admin | Assign them the **Chair** position in that branch (Users → Assign position). Chair carries all permissions + branch-notification visibility. |
| Add a brand-new permission | Migration inserting into `permissions`; add to `PermissionName`; map to positions; gate UI/actions. |
| Add a new position | Super-admin → Positions → create (branch-scoped) then set its permissions. |

---

## 7. Related

- [AUTH.md](AUTH.md) — identity, session, super-admin, impersonation.
- [SCHEMA.md](SCHEMA.md) — `permissions`, `position_permissions`, `member_permissions`, `memberships`, `positions` tables.
- [features/workspace-switching.md](features/workspace-switching.md) — how the active workspace (and thus permission set) is chosen.
- [features/superadmin-portal.md](features/superadmin-portal.md) — the console that mutates all of the above.
