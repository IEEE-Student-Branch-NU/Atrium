# Super Admin Portal — Design Spec

> **Date:** 2026-07-08
> **Status:** Approved design, ready for implementation planning
> **Scope:** Phase 1 of the IEEE Atrium Super Admin Portal
> **Project root:** `E:\IEEE\Atrium\Atrium` (Next.js 16, React 19, next-auth v5 JWT, Supabase service-role, Base UI components)

---

## 1. Overview

Build a dedicated **Super Admin Portal** — a surface completely separate from the normal member/admin experience — that gives a small set of named super admins unrestricted access to every organization, branch, sub-branch, position, user, and workspace in the system.

The portal is a **new route group inside the existing Next.js app** (not a separate application), mounted under `/superadmin/*`. It reuses the app's existing auth, Supabase admin client, permission engine, and UI component library, but has its own layout, sidebar, and pages.

### Goals

- After login, a matched super admin lands directly in the portal and sees a dashboard (stats + organization list).
- Full visibility and management of any organization's committee, members, positions, and users.
- Ability to "open" any user's workspace and see/manage exactly what that user sees (impersonation with full manage powers and a banner).
- Full user, position, and organization management.
- All super-admin actions recorded in an audit log.
- The portal remains **invisible to every non-super-admin** (no DB column, no nav hint, no route access).

---

## 2. Locked decisions (with rationale)

| Decision | Choice | Rationale |
|---|---|---|
| **Access model** | **Direct on login.** Named accounts (matched against the existing hashed `superadmins` table) are routed straight into the portal. No passphrase. | Matches the "after login → dashboard" flow. The portal is invisible to everyone else, so identities still don't leak to regular users. Trade-off accepted: drops the passphrase second factor. |
| **Phase-1 scope** | **Defer** Documents, Tasks, and Teams (no backing data exists). Build everything the current schema supports. | Ships a complete, coherent portal fastest; avoids ballooning into three net-new subsystems. |
| **Org vs Branch vs Sub-Branch** | **Presentation layer over the existing `branches` table.** No schema change. `parent_id IS NULL` → Organization; direct child → Branch; deeper → Sub-Branch. | Fastest, matches "build on real data." |
| **Workspace "open"** | **Impersonation with full manage, attributed to the super admin.** Loads the target user's branch/position context, super admin keeps `['*']`, banner + Exit button, all mutations logged as the super admin. | Matches "inspect and manage." |
| **Audit storage** | **One new `audit_log` table** for structural/super-admin actions; Audit Logs page merges it with the two existing logs. | The existing logs have no home for org/position/permission structural actions. |
| **Exec vs Associate** | **Rule-based by position name.** Executive Committee = leadership positions (Chair, Vice Chair, General Secretary, Technical Head, Creative Head, MDO); Associate Members = everything else (Technical/Marketing Associate, Treasurer, Web Master, general members). | No schema for this classification exists; rule is refinable later. |

---

## 3. Out of scope (Phase 1)

- **Documents** and **Tasks** modules (no tables/routes exist) — future projects.
- **Teams** as an entity (the nav example collapses to Org → Position → Open Workspace).
- **Password reset** — spec calls it "future support"; the button is present but disabled.
- **Branch/organization deletion** — cascades are destructive; a guarded delete is a later addition. Phase 1 supports create + edit only.
- Standing up a full test harness (Vitest/integration) unless requested — see §11.

---

## 4. Architecture & file layout

One app, two isolated surfaces:

```
src/app/
  (portal)/                     ← existing member/admin experience at /
  superadmin/                   ← NEW, at /superadmin/*
    layout.tsx                  ← super-admin guard + sidebar + top bar
    page.tsx                    ← Dashboard
    organizations/
      page.tsx                  ← org tree list
      [branchId]/page.tsx       ← org detail (tabs)
    users/
      page.tsx                  ← searchable user list
      [profileId]/page.tsx      ← user detail
    positions/
      page.tsx                  ← positions grouped by org/branch
    position-requests/page.tsx  ← all-branch request queue + history
    audit/page.tsx              ← unified audit feed
    settings/page.tsx           ← minimal settings
    actions.ts                  ← super-admin-only server actions
    queries.ts                  ← super-admin read helpers

src/components/superadmin/
    sidebar.tsx                 ← distinct sidebar with "SUPER ADMIN" badge
    top-bar.tsx                 ← (or reuse portal top bar)
    impersonation-banner.tsx    ← rendered in (portal) when impersonating

src/utils/auth/
    superadmin.ts               ← isSuperAdmin(email), getEffectiveActor()
    impersonation.ts            ← openWorkspace cookie get/set/clear
    audit.ts                    ← logAdminAction(...)
```

**Guard:** `src/app/superadmin/layout.tsx` re-checks `isSuperAdmin` on every request (defense in depth over middleware). A non-super-admin who reaches any `/superadmin/*` route is redirected to `/`.

---

## 5. Access & identity

### 5.1 `isSuperAdmin(email)`

New helper in `src/utils/auth/superadmin.ts`. Runs the same bcrypt-compare loop that `elevateToSudo` uses today: fetch all rows from `superadmins`, `bcrypt.compare(email, row.hashed_email)` until a match. Result is memoized per request (via `React.cache`) to avoid repeating the bcrypt loop across layout + page + actions in one render.

The `superadmins` table stays the single source of truth (bcrypt-hashed emails). It currently holds **4** entries: Priyansh (`24btm040`), IEEE Official (`ieee@`), Vraj (`24btm032`), and Manisha Shah. Confirm the final roster during implementation; roster changes are done via SQL/migration.

### 5.2 Middleware routing

In `src/utils/supabase/middleware.ts`:

- On a matched super admin hitting `/` (and not impersonating) → redirect to `/superadmin`.
- On any user hitting `/superadmin/*` who is **not** a super admin → redirect to `/`.
- The existing status gating (pending/rejected/no-IEEE-ID) is skipped for super admins reaching the portal (a super admin account must still be an approved profile to have a session, but the portal itself does not require a completed membership).

> Note: `isSuperAdmin` runs a bcrypt loop, which is comparatively heavy for middleware. Keep the check scoped to the two cases above (root redirect and `/superadmin/*`), not every request. If it proves too costly, cache the "is this email a super admin" result in the JWT at sign-in time (see §5.5 open item).

### 5.3 Permission engine change

`src/utils/auth/permissions.ts`: replace the `isSudoMode()` cookie short-circuit with `isSuperAdmin(session.user.email)`. `getUserPermissions` and `canApproveRegistrations` return `['*']` / `true` whenever the current session belongs to a super admin — including while impersonating (full manage).

### 5.4 Retire `/sudo` and fix the split-brain flag

- **Remove** `src/app/sudo/` (page + actions) and `src/utils/auth/sudo.ts`; drop the `sudo_mode` cookie usage. The passphrase flow is superseded by direct login.
- **Fix stale `is_super_admin` reads** that break against migration `00004` (which dropped the column): `src/lib/queries.ts` (`getUserProfileWithMembership`, `getFullUserProfile`) and `src/app/(portal)/notifications/{page,actions}.ts`. Standardize their super-admin checks on `isSuperAdmin(email)`.
- Update `docs/SCHEMA.md`, which still documents the removed `is_super_admin` column and the old sudo model.

### 5.5 Open item

Optionally stamp an `isSuperAdmin` boolean into the JWT during the next-auth `jwt` callback at sign-in, so middleware and pages read a token flag instead of re-running the bcrypt loop. Deferred unless the per-request cache proves insufficient. Does not change the `superadmins` table as source of truth.

---

## 6. Workspace impersonation

### 6.1 Mechanism

- New super-admin-only server action `openWorkspace(membershipId)` sets a **signed, httpOnly cookie** `atrium_impersonate` containing the target `membership_id`. Unlike the normal `switchWorkspace`, it does **not** require the membership to belong to the caller — it validates only that the caller is a super admin and the target membership exists and is active.
- New helper `getEffectiveActor()` in `src/utils/auth/superadmin.ts` returns:
  ```
  {
    realProfileId,        // the super admin (from auth())
    actingProfileId,      // target profile when impersonating, else realProfileId
    actingMembershipId,   // target membership when impersonating
    isImpersonating,      // boolean
    isSuperAdmin,         // boolean
  }
  ```
- The `(portal)` layout and pages resolve **display/data** through `actingProfileId` / `actingMembershipId` (so the member sees the impersonated user's branch/position context and data), while **`auth()` still returns the real super admin**, so every audit write is automatically attributed to the super admin.

### 6.2 Banner & exit

- `src/components/superadmin/impersonation-banner.tsx` renders a persistent banner in the `(portal)` layout whenever `isImpersonating` is true: *"Viewing [User]'s workspace — Super Admin mode"* with an **Exit** button.
- `exitWorkspace()` action clears the `atrium_impersonate` cookie and redirects to `/superadmin`.

### 6.3 Entry points

"Open Workspace" buttons appear on:
- Organization detail → Users tab (per member).
- User detail page (per active membership).

### 6.4 Touch points

Portal files that resolve the current actor must switch from `session.user.id` to `getEffectiveActor().actingProfileId`: `src/app/(portal)/layout.tsx`, `page.tsx`, `profile/page.tsx`, `position-requests/page.tsx`, and any action that reads "the current user's" data for display. Mutations that must be attributed keep using the real super admin id.

---

## 7. Data model mapping (presentation layer)

- **Organization** = branch with `parent_id IS NULL` (e.g. IEEE SBNU). **Branch** = direct child (SPS, WIE, CS, …). **Sub-Branch** = deeper descendant.
- **Total Organizations** = count of root branches. **Total Branches** = count of all branches.
- **Create Organization** = insert a root branch (`parent_id = NULL`). **Create Sub-Branch** = insert a child branch under a chosen parent.
- **Executive Committee** (per branch) = active memberships whose position is in the leadership set. **Associate Members** = active memberships whose position is outside that set (plus general members with no position). The leadership set is a constant in code (`LEADERSHIP_POSITIONS`), refinable later.

---

## 8. New `audit_log` table

Migration `00008_audit_log.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id  UUID NOT NULL REFERENCES profiles(id),
  action            TEXT NOT NULL,          -- e.g. 'org_created', 'position_assigned', 'permission_granted', 'workspace_opened'
  entity_type       TEXT NOT NULL,          -- 'organization' | 'branch' | 'position' | 'user' | 'membership' | 'permission' | 'workspace'
  entity_id         UUID,                   -- nullable (structural entities without a single id)
  branch_id         UUID REFERENCES branches(id),
  summary           TEXT NOT NULL,          -- human-readable one-liner
  details           JSONB,                  -- before/after snapshot or context
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity  ON audit_log(entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY; -- service-role only, no public policies
```

`logAdminAction({actorProfileId, action, entityType, entityId, branchId, summary, details})` in `src/utils/auth/audit.ts` is called by every super-admin mutation. The **Audit Logs** page reads this table and merges it with `event_audit_log` and `membership_audit_log` into one chronological, filterable feed.

---

## 9. Modules

Sidebar (`src/components/superadmin/sidebar.tsx`, with a "SUPER ADMIN" badge and a distinct accent): **Dashboard · Organizations · Users · Positions · Position Requests · Audit Logs · Settings · Logout**.

### 9.1 Dashboard — `/superadmin`
Six stat cards: Total Users, Total Organizations, Total Branches, Total Positions, Pending Position Requests, and a Recent Activities feed. Below: the Organizations & Branches tree (Org → Branch → Sub-Branch), each row linking to its detail page.
- **Queries:** `getSuperAdminStats()`, `getOrganizationTree()`, `getRecentActivityFeed(limit)`.

### 9.2 Organizations — `/superadmin/organizations` + `/[branchId]`
List = the org tree. Detail page tabs: **Overview · Executive Committee · Associate Members · Positions · Users**. Positions tab manages that branch's positions and their granted permissions. Users tab lists active members, each with an **Open Workspace** action.
- **Queries:** `getBranchDetail(branchId)`, `getBranchMembers(branchId)`, `getBranchExecAndAssociates(branchId)`.
- **Actions:** `createOrganization(name, slug, description)`, `createSubBranch(parentId, name, slug, description)`, `updateBranch(id, fields)`.

### 9.3 Users — `/superadmin/users` + `/[profileId]`
Searchable, paginated list of all profiles (name / email / IEEE ID + status filter). Detail page: profile, active positions, position history, direct permission grants. Actions: **Assign position** (reuses the vetted membership-creation logic from `approvePositionRequest`), **Remove position** (ends the membership), **Change permissions** (grant/revoke `member_permissions`), **Open Workspace**, and a disabled **Reset Password** ("future"). All mutations audited.
- **Queries:** `listUsers({search, status, page})`, `getUserAdminDetail(profileId)`.
- **Actions:** `assignPosition`, `removePosition`, `grantPermission`, `revokePermission`, `openWorkspace`, `exitWorkspace`.

### 9.4 Positions — `/superadmin/positions`
Global list grouped by org/branch. Create / Edit / Delete positions and set which permissions each position grants (`position_permissions`). Assigning a position to a user routes through the Users flow.
- **Queries:** `listPositionsGrouped()`, `getPositionDetail(positionId)`.
- **Actions:** `createPosition`, `updatePosition`, `deletePosition`, `setPositionPermissions(positionId, permissionIds[])`.

### 9.5 Position Requests — `/superadmin/position-requests`
Reuses `getPendingPositionRequests()` (already all-branch) and `approvePositionRequest` / `rejectPositionRequest` (already pass for `['*']`). Adds an `audit_log` write and shows full request history alongside the pending queue.

### 9.6 Audit Logs — `/superadmin/audit`
Unified, filterable feed (actor · entity/action type · branch · date range) merging `audit_log` + `event_audit_log` + `membership_audit_log`.
- **Query:** `getAuditLog({filters, page})`.

### 9.7 Settings — `/superadmin/settings`
Minimal: theme, current session info, a read-only super-admin roster (count + note that it's managed via migration, since emails are hashed), and placeholders for future policy (password-reset, session length).

---

## 10. New building blocks summary

**Query helpers** (`src/app/superadmin/queries.ts`): `getSuperAdminStats`, `getOrganizationTree`, `getRecentActivityFeed`, `getBranchDetail`, `getBranchMembers`, `getBranchExecAndAssociates`, `listUsers`, `getUserAdminDetail`, `listPositionsGrouped`, `getPositionDetail`, `getAuditLog`.

**Server actions** (`src/app/superadmin/actions.ts`): `createOrganization`, `createSubBranch`, `updateBranch`, `assignPosition`, `removePosition`, `grantPermission`, `revokePermission`, `createPosition`, `updatePosition`, `deletePosition`, `setPositionPermissions`, `openWorkspace`, `exitWorkspace`. Every mutation calls `logAdminAction` and re-verifies `isSuperAdmin`.

**Auth utils:** `src/utils/auth/superadmin.ts` (`isSuperAdmin`, `getEffectiveActor`), `src/utils/auth/impersonation.ts` (cookie get/set/clear), `src/utils/auth/audit.ts` (`logAdminAction`).

**UI components likely to add** (Base UI / shadcn-style, none exist yet): `checkbox`, `switch`, `pagination`, and a search input (or a lightweight `command`) for the user list. Plus `src/components/superadmin/{sidebar,impersonation-banner}.tsx`.

**Migration:** `supabase/migrations/00008_audit_log.sql`.

---

## 11. Security considerations

- All DB access is service-role (RLS bypassed), so **authorization lives entirely in app code**. Every `/superadmin/*` page guards via the layout's `isSuperAdmin` check, and every super-admin action re-verifies `isSuperAdmin` before mutating.
- The impersonation cookie is signed (jose HS256 with `AUTH_SECRET`) and httpOnly; `openWorkspace` only accepts it from a verified super admin.
- Removing the passphrase means a hijacked super-admin Google session grants full access — an accepted trade-off. Session length and reset policy are noted as future settings.
- The `audit_log` table has RLS enabled with no public policies (service-role only), mirroring `superadmins`.

---

## 12. Verification approach

The repo has no test runner today. Phase-1 verification:

- **Hard gates:** `npm run build` (typecheck) and `npm run lint` must pass.
- **Unit tests for pure logic** (recommended, small): the Exec/Associate classifier, the org-tree mapper, and `getEffectiveActor`'s impersonation resolution. (`isSuperAdmin` depends on bcrypt + DB, so cover it with an integration-style check or manual verification.)
- **Manual / `verify`-skill walkthroughs** per module: dashboard counts, org detail tabs, user search + assign/remove position + permission change, position CRUD, open/exit workspace with the banner, and an audit-log entry appearing for each action.
- If a fuller harness (Vitest + integration tests) is wanted, it can be added at plan time.

---

## 13. Assumptions to confirm during implementation

1. Final super-admin roster (keep all 4 including Manisha Shah, or the 3 named in the request?).
2. Route prefix `/superadmin` (vs. an alternative like `/admin` or `/god`).
3. The `LEADERSHIP_POSITIONS` set for the Exec/Associate split.
4. Whether to stamp `isSuperAdmin` into the JWT (§5.5) now or defer.
