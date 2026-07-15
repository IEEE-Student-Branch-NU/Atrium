# IEEE SBNU Event Creation Portal — Database Schema (v2)

> **Last Updated:** July 2026 | **Migrations:** `00001_initial_schema.sql` through `00011_notification_routing.sql` (see [§10 Migration History](#10-migration-history) for the full list)

This document is the single source of truth for the database architecture. It covers every table, enum, trigger, index, and seed record — along with the reasoning behind each decision. Written for future team members to read, review, and tweak.

---

## Table of Contents

1. [Architectural Decisions](#1-architectural-decisions--thought-process)
2. [Enums](#2-enums)
3. [Entity Relationship Diagram](#3-entity-relationship-diagram-erd)
4. [Table Reference](#4-table-reference)
5. [Triggers & Functions](#5-triggers--functions)
6. [Indexes](#6-indexes)
7. [Seeded Data](#7-seeded-data)
8. [Permission Matrix](#8-default-permission-matrix)
9. [Key Query Patterns](#9-key-query-patterns)
10. [Migration History](#10-migration-history)

---

## 1. Architectural Decisions & Thought Process

### 1.1 Identity & Registration Gating
- **Decision:** Use Supabase `auth.users` combined with a synced `profiles` table.
- **Why:** Supabase recommends keeping `auth.users` secure and separate. A trigger auto-syncs new signups to a public `profiles` table so we can safely join user data in queries without exposing auth secrets.
- **Registration Gating:** Not everyone with a `@nirmauni.ac.in` email should get access. The portal requires an **IEEE Membership ID** during signup. Accounts start in `pending` status and remain locked until:
  - **Auto-approved:** The MDO pre-loaded their membership ID into `pre_approved_members`, OR
  - **Manually approved:** An admin/MDO/SuperAdmin reviews and approves the registration.

### 1.2 Permission-Based Access Control
Previously, a simple `portal_role` enum (`member`, `admin`, `super_admin`) controlled everything. In v2, this was replaced with **granular, position-based permissions** following the principle of least privilege.
- **Decision:** Decouple "what you are called" (position) from "what you can do" (permissions).
- **Why:** When a new position is created (e.g., "Social Media Head"), the admin just assigns the right permissions to it — no code changes required. When the Chair changes, the new person automatically inherits all Chair permissions.
- **Components:**
  - `positions` → branch-scoped titles (Chair, MDO, etc.)
  - `permissions` → atomic system actions (`create_events`, `approve_registrations`, etc.)
  - `position_permissions` → maps positions to their allowed permissions
  - `member_permissions` → ad-hoc grants for individual users (override/supplement)
  - `superadmins` → global system bypass, identified out-of-band (see §1.7) rather than a flag on `profiles`

### 1.3 Membership History (Append-Only)
- **Decision:** Single `memberships` table, never overwrite.
- **Why:** We need to answer "who was Chair in 2024?" without a separate history table. Active membership = `ended_at IS NULL`. On role change, set `ended_at = now()` on the old row and INSERT a new one.
- **Performance:** Partial B-Tree indexes on `ended_at IS NULL` keep active lookups fast even with years of history.

### 1.4 Multi-Level Event Approvals
- **Decision:** Separate `event_approvals` table with a `level` column.
- **Why:** Supports arbitrary approval tiers (Level 1 = Branch Chair, Level 2 = SBNU admin) without schema changes if rules evolve.

### 1.5 Hard Deletes + Audit Snapshots
- **Decision:** Events are hard-deleted. Before deletion, a full JSONB snapshot is saved in `event_audit_log`.
- **Why:** Soft deletes (`deleted_at`) pollute every query with `WHERE deleted_at IS NULL`. The audit log preserves all history with its `event_id` column intentionally **not** a foreign key (so it survives the delete).

### 1.6 Image Storage (JSONB)
- **Decision:** Store ImageKit metadata as a JSONB column on `events.banner`.
- **Why:** Extensible without schema changes. Currently stores `{ url, file_id, width, height, format }`. Can easily add thumbnails or crops later.

### 1.7 Invisible SuperAdmin Identity (No `profiles` Flag)
- **Decision:** SuperAdmin status is **not** a column on `profiles`. It is determined by matching the signed-in user's email (bcrypt-compared) against the `superadmins` table, and is stamped onto the NextAuth JWT as `session.isSuperAdmin` at sign-in.
- **Why:** An earlier version (migration `00002`) used a plain `is_super_admin BOOLEAN` on `profiles`. Migration `00004_invisible_superadmin.sql` dropped that column so SuperAdmin status can't be discovered by querying/joining `profiles`, and moved the source of truth to a dedicated table with hashed emails and RLS enabled (service-role only, no public policies).
- **How it's checked:** `isSuperAdmin(email)` in `src/utils/auth/superadmin.ts` loads all `superadmins.hashed_email` rows and bcrypt-compares the candidate email against each. The result is cached into the session at login; downstream code (e.g. the permission engine in `src/utils/auth/permissions.ts`) reads `session.isSuperAdmin` and short-circuits to the `['*']` wildcard rather than re-querying `superadmins` on every check.
- **Superseded:** An earlier "sudo mode" design (a passphrase-gated `/sudo` route setting an elevation cookie, with a matching `passphrase_hash` column on `superadmins`) has been removed from the app. The `superadmins.passphrase_hash` column still exists from migration `00004` but is no longer read by the app.
- **Audit trail:** Actions taken through the SuperAdmin portal (`/superadmin/**`) are recorded in the `audit_log` table (migration `00008`, documented in §4.14) via `logAdminAction()` in `src/utils/auth/audit.ts` — a best-effort write that never throws into the caller.

---

## 2. Enums

| Enum | Values | Used In |
|------|--------|---------|
| `registration_status` | `pending`, `approved`, `rejected` | `profiles.status` |
| `event_status` | `draft`, `pending_approval`, `approved`, `rejected`, `published` | `events.status` |
| `approval_decision` | `approved`, `rejected` | `event_approvals.decision` |

> **Note:** The old `portal_role` enum (`member`, `admin`, `super_admin`) was **dropped** in migration `00002`. It is replaced by the permission system.

---

## 3. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    profiles {
        UUID id PK "FK → auth.users"
        TEXT email UK
        TEXT full_name
        TEXT avatar_url
        TEXT ieee_membership_id UK
        TEXT phone
        TEXT section
        DATE membership_expiry
        registration_status status
        UUID approved_by FK
        TIMESTAMPTZ approved_at
        TEXT rejected_reason
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    branches {
        UUID id PK
        TEXT name
        TEXT slug UK
        UUID parent_id FK "self-ref → branches"
        TEXT description
        TIMESTAMPTZ created_at
    }

    positions {
        UUID id PK
        UUID branch_id FK "→ branches"
        TEXT name "UQ(branch_id, name)"
        TIMESTAMPTZ created_at
    }

    permissions {
        UUID id PK
        TEXT name UK
        TEXT description
        TIMESTAMPTZ created_at
    }

    position_permissions {
        UUID id PK
        UUID position_id FK "→ positions"
        UUID permission_id FK "→ permissions"
    }

    member_permissions {
        UUID id PK
        UUID profile_id FK "→ profiles"
        UUID branch_id FK "→ branches"
        UUID permission_id FK "→ permissions"
        UUID granted_by FK "→ profiles"
        TIMESTAMPTZ granted_at
        TIMESTAMPTZ revoked_at "NULL = active"
    }

    memberships {
        UUID id PK
        UUID profile_id FK "→ profiles"
        UUID branch_id FK "→ branches"
        UUID position_id FK "→ positions"
        DATE joined_date
        TIMESTAMPTZ assigned_at
        TIMESTAMPTZ ended_at "NULL = active"
        UUID assigned_by FK "→ profiles"
        TEXT reason
        TIMESTAMPTZ created_at
    }

    pre_approved_members {
        UUID id PK
        TEXT ieee_membership_id UK
        TEXT name
        TEXT email
        UUID added_by FK "→ profiles"
        TIMESTAMPTZ created_at
    }

    event_types {
        UUID id PK
        TEXT name UK
        TEXT description
        TIMESTAMPTZ created_at
    }

    events {
        UUID id PK
        UUID branch_id FK "→ branches"
        UUID creator_id FK "→ profiles"
        UUID event_type_id FK "→ event_types"
        TEXT name
        TEXT description
        TIMESTAMPTZ event_date
        TEXT organizer_email
        JSONB banner "ImageKit metadata"
        INT capacity
        TEXT location
        event_status status
        TIMESTAMPTZ created_at
        TIMESTAMPTZ submitted_at
        TIMESTAMPTZ published_at
        TIMESTAMPTZ updated_at
    }

    event_approvals {
        UUID id PK
        UUID event_id FK "→ events"
        INT level "1 = branch 2 = SBNU"
        UUID approver_id FK "→ profiles"
        approval_decision decision
        TEXT comment
        TIMESTAMPTZ decided_at
    }

    event_audit_log {
        UUID id PK
        UUID event_id "NO FK — survives delete"
        TEXT action
        UUID changed_by FK "→ profiles"
        JSONB details "snapshot"
        TIMESTAMPTZ created_at
    }

    membership_audit_log {
        UUID id PK
        UUID profile_id FK "→ profiles"
        UUID branch_id FK "→ branches"
        TEXT action
        UUID changed_by FK "→ profiles"
        JSONB details
        TIMESTAMPTZ created_at
    }

    audit_log {
        UUID id PK
        UUID actor_profile_id FK "→ profiles"
        TEXT action
        TEXT entity_type
        UUID entity_id "no FK — polymorphic target"
        UUID branch_id FK "→ branches, nullable"
        TEXT summary
        JSONB details
        TIMESTAMPTZ created_at
    }

    notifications {
        UUID id PK
        UUID profile_id FK "→ profiles, nullable for broadcast"
        TEXT title
        TEXT message
        TEXT link
        BOOLEAN is_read
        TIMESTAMPTZ created_at
        TEXT type "normal, broadcast, success, warning, error"
    }

    profiles ||--o{ memberships : "profile_id"
    profiles ||--o{ member_permissions : "profile_id"
    profiles ||--o{ events : "creator_id"
    profiles ||--o{ event_approvals : "approver_id"
    profiles ||--o{ event_audit_log : "changed_by"
    profiles ||--o{ membership_audit_log : "changed_by"
    profiles ||--o{ audit_log : "actor_profile_id"
    profiles ||--o{ notifications : "profile_id"

    branches ||--o| branches : "parent_id"
    branches ||--o{ positions : "branch_id"
    branches ||--o{ memberships : "branch_id"
    branches ||--o{ events : "branch_id"
    branches ||--o{ member_permissions : "branch_id"
    branches ||--o{ membership_audit_log : "branch_id"
    branches ||--o{ audit_log : "branch_id"

    positions ||--o{ memberships : "position_id"
    positions ||--o{ position_permissions : "position_id"
    permissions ||--o{ position_permissions : "permission_id"
    permissions ||--o{ member_permissions : "permission_id"

    event_types ||--o{ events : "event_type_id"
    events ||--o{ event_approvals : "event_id"
    events ||--o{ event_audit_log : "event_id"

    pre_approved_members }o--|| profiles : "added_by"
```

---

## 4. Table Reference

### 4.1 `profiles`
Auto-created via trigger when a user signs up. Stores public identity + registration status.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, FK → `auth.users` | Supabase-managed user ID |
| `email` | TEXT | NOT NULL, UNIQUE | From auth provider |
| `full_name` | TEXT | | Google profile name |
| `avatar_url` | TEXT | | Google profile picture |
| `ieee_membership_id` | TEXT | UNIQUE | e.g. `123456789` |
| `phone` | TEXT | | Contact number |
| `section` | TEXT | DEFAULT `'Gujarat Section'` | IEEE organizational section |
| `membership_expiry` | DATE | | When IEEE membership expires |
| `status` | `registration_status` | NOT NULL, DEFAULT `'pending'` | Registration approval state |
| `approved_by` | UUID | FK → `profiles` | Who approved this registration |
| `approved_at` | TIMESTAMPTZ | | When they were approved |
| `rejected_reason` | TEXT | | Why registration was denied |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Auto-updated via trigger |

---

### 4.2 `branches`
IEEE organizational hierarchy. SBNU is the root node.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `name` | TEXT | NOT NULL | e.g. "IEEE CS" |
| `slug` | TEXT | NOT NULL, UNIQUE | URL-safe identifier |
| `parent_id` | UUID | FK → `branches` | NULL = root (SBNU) |
| `description` | TEXT | | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |

---

### 4.3 `positions`
Branch-scoped organizational titles.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `branch_id` | UUID | NOT NULL, FK → `branches`, ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL, UQ(`branch_id`, `name`) | e.g. "Chair", "MDO" |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |

---

### 4.4 `permissions`
Atomic system-wide actions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `name` | TEXT | NOT NULL, UNIQUE | Slug, e.g. `create_events` |
| `description` | TEXT | | Human-readable explanation |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |

---

### 4.5 `position_permissions`
Maps positions → permissions (many-to-many).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `position_id` | UUID | NOT NULL, FK → `positions`, ON DELETE CASCADE |
| `permission_id` | UUID | NOT NULL, FK → `permissions`, ON DELETE CASCADE |
| | | UQ(`position_id`, `permission_id`) |

---

### 4.6 `member_permissions`
Direct ad-hoc permission grants to individual members (independent of position).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `profile_id` | UUID | NOT NULL, FK → `profiles`, ON DELETE CASCADE | |
| `branch_id` | UUID | NOT NULL, FK → `branches`, ON DELETE CASCADE | Scoped per branch |
| `permission_id` | UUID | NOT NULL, FK → `permissions`, ON DELETE CASCADE | |
| `granted_by` | UUID | NOT NULL, FK → `profiles` | Who gave this permission |
| `granted_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |
| `revoked_at` | TIMESTAMPTZ | | NULL = still active |
| | | UQ(`profile_id`, `branch_id`, `permission_id`, `granted_at`) | |

---

### 4.7 `memberships`
Append-only history of who held what position in which branch.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `profile_id` | UUID | NOT NULL, FK → `profiles`, ON DELETE CASCADE | |
| `branch_id` | UUID | NOT NULL, FK → `branches`, ON DELETE CASCADE | |
| `position_id` | UUID | FK → `positions` | Nullable (general member) |
| `joined_date` | DATE | | When they joined the branch |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | When this role started |
| `ended_at` | TIMESTAMPTZ | | NULL = currently active |
| `assigned_by` | UUID | FK → `profiles` | Who assigned this role |
| `reason` | TEXT | | Why the change was made |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |
| | | UQ(`profile_id`, `branch_id`, `position_id`, `assigned_at`) | |

---

### 4.8 `pre_approved_members`
MDO/SuperAdmin pre-loads IEEE IDs here. Signup with a matching ID → instant approval.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `ieee_membership_id` | TEXT | NOT NULL, UNIQUE | Must match exactly |
| `name` | TEXT | NOT NULL | Expected name (for verification) |
| `email` | TEXT | | Optional hint |
| `added_by` | UUID | FK → `profiles` | Who added this record |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |

---

### 4.9 `event_types`
Admin-managed lookup table for event categories.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | TEXT | NOT NULL, UNIQUE |
| `description` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` |

---

### 4.10 `events`
Core event entity. Moves through a state machine: `draft` → `pending_approval` → `approved`/`rejected` → `published`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `branch_id` | UUID | NOT NULL, FK → `branches`, ON DELETE CASCADE | |
| `creator_id` | UUID | NOT NULL, FK → `profiles` | Who created the draft |
| `event_type_id` | UUID | FK → `event_types` | Nullable |
| `name` | TEXT | NOT NULL | |
| `description` | TEXT | NOT NULL | |
| `event_date` | TIMESTAMPTZ | NOT NULL | |
| `organizer_email` | TEXT | NOT NULL | |
| `banner` | JSONB | | `{ url, file_id, width, height, format }` |
| `capacity` | INT | | |
| `location` | TEXT | | |
| `status` | `event_status` | NOT NULL, DEFAULT `'draft'` | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |
| `submitted_at` | TIMESTAMPTZ | | When submitted for approval |
| `published_at` | TIMESTAMPTZ | | When published to public |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | Auto-updated via trigger |

---

### 4.11 `event_approvals`
One row per approval level per event.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `event_id` | UUID | NOT NULL, FK → `events`, ON DELETE CASCADE | |
| `level` | INT | NOT NULL, DEFAULT `1` | 1 = branch, 2 = SBNU |
| `approver_id` | UUID | NOT NULL, FK → `profiles` | |
| `decision` | `approval_decision` | NOT NULL | `approved` or `rejected` |
| `comment` | TEXT | | Reviewer's note |
| `decided_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |
| | | UQ(`event_id`, `level`) | One decision per level |

---

### 4.12 `event_audit_log`
Immutable lifecycle log. `event_id` is **not** a FK — rows survive event hard-deletes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `event_id` | UUID | | **No FK** — intentional |
| `action` | TEXT | NOT NULL | `created`, `submitted`, `approved`, `rejected`, `published`, `deleted`, `edited` |
| `changed_by` | UUID | NOT NULL, FK → `profiles` | |
| `details` | JSONB | | Snapshot of changes. On delete: full event data |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |

---

### 4.13 `membership_audit_log`
Immutable log of all membership/role/position changes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `profile_id` | UUID | NOT NULL, FK → `profiles` | |
| `branch_id` | UUID | NOT NULL, FK → `branches` | |
| `action` | TEXT | NOT NULL | `role_assigned`, `role_revoked`, `position_changed`, etc. |
| `changed_by` | UUID | NOT NULL, FK → `profiles` | |
| `details` | JSONB | | `{ old_position, new_position, reason }` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |

---

### 4.14 `audit_log`
*(Added in migration `00008_audit_log.sql`.)* Unified, append-only log of super-admin / structural actions taken through the SuperAdmin portal (`/superadmin/**`) — e.g. creating a branch, assigning/removing a position, granting/revoking a permission, positions CRUD, deciding a position request, entering/exiting workspace impersonation. It **complements — and for some actions overlaps with —** the two older audit tables rather than replacing them: `event_audit_log` (event lifecycle) and `membership_audit_log` (all membership/role/position changes, plus some self-service events such as a user's own password change in `src/app/(portal)/profile/actions.ts` and workspace switches in `src/app/(portal)/actions.ts`). In particular, super-admin position assign/remove (`assignPosition`/`removePosition` in `src/app/superadmin/actions.ts`) are recorded in **both** `membership_audit_log` (tagged `details.via: 'super_admin'`) **and** `audit_log`, so for those actions the two tables are not disjoint. Written by `logAdminAction()` in `src/utils/auth/audit.ts`, which is a **best-effort** write (failures are logged and swallowed — a failed audit insert never blocks or throws into the calling action).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, DEFAULT `gen_random_uuid()` | |
| `actor_profile_id` | UUID | NOT NULL, FK → `profiles` | Who performed the action (the real SuperAdmin, not an impersonated identity) |
| `action` | TEXT | NOT NULL | Free-form action slug, e.g. `branch_created`, `position_assigned`, `permission_granted` |
| `entity_type` | TEXT | NOT NULL | One of `organization`, `branch`, `position`, `user`, `membership`, `permission`, `workspace` (per the `AdminAction` type in `audit.ts`) |
| `entity_id` | UUID | | Nullable, **no FK** — polymorphic target, points at a row in whichever table `entity_type` names |
| `branch_id` | UUID | FK → `branches` | Nullable — scopes the action to a branch when applicable |
| `summary` | TEXT | NOT NULL | Human-readable one-line description shown on the Audit page |
| `details` | JSONB | | Optional structured payload (e.g. before/after values) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |

**RLS:** Enabled with **no public policies** — only the service-role client (`createAdminClient()`) can read or write this table, consistent with `superadmins`.

---

### 4.15 `notifications`
Added in migration `00006_workspace_and_requests.sql`; modified in `00007_notification_types.sql`, `00009_broadcast_notifications.sql`, and **`00011_notification_routing.sql`**. Stores in-app notifications. Since `00011` the table has a **routing dimension (`audience`)** separate from the **styling dimension (`type`)**, plus a **branch context** so Chairs and super-admins can see branch-scoped activity. See [features/notifications.md](features/notifications.md) for the full system (event catalog, triggers, email, super-admin oversight, Chair feed). Included in the `supabase_realtime` publication for WebSocket streaming.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, DEFAULT `gen_random_uuid()` | |
| `profile_id` | UUID | FK → `profiles`, ON DELETE CASCADE | Nullable — NULL for `branch`/`broadcast` audiences |
| `title` | TEXT | NOT NULL | |
| `message` | TEXT | NOT NULL | |
| `link` | TEXT | | Optional URL |
| `is_read` | BOOLEAN | NOT NULL, DEFAULT `false` | Per-row (shared for branch/broadcast) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |
| `type` | TEXT | NOT NULL, DEFAULT `'normal'` | **Severity/styling:** `normal`, `info`, `success`, `warning`, `error` (legacy `broadcast` backfilled → `info`) |
| `audience` | TEXT | NOT NULL, DEFAULT `'user'` | **Routing:** `user` \| `branch` \| `broadcast` *(00011)* |
| `branch_id` | UUID | FK → `branches` | Branch context; required for `branch` audience *(00011)* |
| `event_key` | TEXT | | Machine key of the trigger, e.g. `registration.approved` *(00011)* |
| `actor_profile_id` | UUID | FK → `profiles` | Who caused it; NULL for system events *(00011)* |

**Constraints (since `00011`):**
- `notifications_audience_check`: CHECK — `user` ⇒ `profile_id NOT NULL`; `branch` ⇒ `branch_id NOT NULL AND profile_id IS NULL`; `broadcast` ⇒ `profile_id IS NULL`. (Replaces the old `notifications_recipient_check`, which keyed off `type = 'broadcast'`.)

**RLS (since `00011`):** policy `read own, broadcast, or chair-branch` — a row is visible if `audience = 'broadcast'`, OR `audience = 'user' AND auth.uid() = profile_id`, OR `audience = 'branch'` and the caller holds an **active `Chair` membership** in that `branch_id`. Super-admin reads use the service-role client and bypass RLS.

---

**Known follow-up:** The SuperAdmin Audit page currently reads only from `audit_log` (Phase-1 scope). Merging the legacy `event_audit_log` and `membership_audit_log` feeds into the same view is a flagged, not-yet-implemented extension (the `source` parameter in `getAuditLog()` is already wired for it).

---

## 5. Triggers & Functions

| Trigger | Table | Function | Purpose |
|---------|-------|----------|---------|
| ~~`on_auth_user_created`~~ | ~~`auth.users`~~ | ~~`handle_new_user()`~~ | **DROPPED in `00003`** — see note below |
| `profiles_updated_at` | `profiles` | `update_updated_at()` | Auto-sets `updated_at = now()` on any profile update |
| `events_updated_at` | `events` | `update_updated_at()` | Auto-sets `updated_at = now()` on any event update |
| `position_requests_updated_at` | `position_requests` | `update_updated_at()` | Auto-sets `updated_at = now()` on request update *(00006)* |

> **`handle_new_user()` is no longer active.** It was created in `00001` (and updated in `00002`) to auto-create a `profiles` row from `auth.users` on Supabase-Auth signup. Migration `00003_nextauth_migration.sql` **dropped the `on_auth_user_created` trigger** and decoupled `profiles` from `auth.users` when the app moved to NextAuth. Profile rows are now created **explicitly in application code** (`signUp` / `completeRegistration` in `src/app/auth/actions.ts`), not by a DB trigger. The function body still exists but nothing fires it.

---

## 6. Indexes

| Index | Table | Columns | Type | Notes |
|-------|-------|---------|------|-------|
| `idx_memberships_active` | `memberships` | `(profile_id, branch_id)` | Partial (`ended_at IS NULL`) | Fast active membership lookup |
| `idx_memberships_branch_active` | `memberships` | `(branch_id)` | Partial (`ended_at IS NULL`) | All active members in a branch |
| `idx_member_permissions_active` | `member_permissions` | `(profile_id, branch_id)` | Partial (`revoked_at IS NULL`) | Active direct permission grants |
| `idx_events_branch_status` | `events` | `(branch_id, status)` | B-Tree | Dashboard: events by branch + status |
| `idx_events_creator` | `events` | `(creator_id)` | B-Tree | "My events" list |
| `idx_event_approvals_event` | `event_approvals` | `(event_id)` | B-Tree | Approvals for an event |
| `idx_event_audit_event` | `event_audit_log` | `(event_id)` | B-Tree | Audit trail for an event |
| `idx_event_audit_action` | `event_audit_log` | `(action)` | B-Tree | Filter by action type |
| `idx_membership_audit_profile` | `membership_audit_log` | `(profile_id)` | B-Tree | Audit trail for a user |
| `idx_membership_audit_branch` | `membership_audit_log` | `(branch_id)` | B-Tree | Audit trail for a branch |
| `idx_audit_log_created` | `audit_log` | `(created_at DESC)` | B-Tree | Audit page: newest actions first |
| `idx_audit_log_actor` | `audit_log` | `(actor_profile_id)` | B-Tree | Filter by actor (e.g. "actions by me") |
| `idx_audit_log_entity` | `audit_log` | `(entity_type, entity_id)` | B-Tree | Look up all audit entries for a given entity |

---

## 7. Seeded Data

### 7.1 Branches
| Name | Slug | Parent |
|------|------|--------|
| IEEE SBNU | `sbnu` | — (root) |
| IEEE SIGHT | `sight` | SBNU |
| IEEE WIE | `wie` | SBNU |
| IEEE CS | `cs` | SBNU |
| IEEE ITSS | `itss` | SBNU |
| IEEE SPS | `sps` | SBNU |

### 7.2 Positions (per branch × 6 branches = 36 rows)
`Chair`, `Vice Chair`, `General Secretary`, `Technical Head`, `Creative Head`, `MDO`

### 7.3 Event Types
`Workshop`, `Hackathon`, `Guest Lecture`, `Social`, `Competition`, `Seminar`

### 7.4 Permissions
| Name | Description |
|------|-------------|
| `create_events` | Create event drafts in a branch |
| `approve_events` | Approve or reject pending events |
| `manage_events` | Edit or delete any event in the branch |
| `manage_members` | Assign positions and grant permissions |
| `approve_registrations` | Approve or reject new member signups |
| `view_members` | View member list and role history |
| `view_audit_log` | Access the audit trail |
| `manage_event_types` | Add or edit event categories |
| `manage_positions` | Create custom positions for the branch |

---

## 8. Default Permission Matrix

Shows which permissions each position gets **out of the box** (seeded in migration `00002`):

| Permission | Chair | Vice Chair | Gen. Secretary | Tech Head | Creative Head | MDO |
|:-----------|:-----:|:----------:|:--------------:|:---------:|:-------------:|:---:|
| `create_events` | ✅ | ✅ | ✅ | ✅ | ✅ | |
| `approve_events` | ✅ | ✅ | | | | |
| `manage_events` | ✅ | ✅ | | | | |
| `manage_members` | ✅ | ✅ | | | | |
| `approve_registrations` | ✅ | ✅ | | | | ✅ |
| `view_members` | ✅ | ✅ | | ✅ | ✅ | ✅ |
| `view_audit_log` | ✅ | ✅ | ✅ | | | |
| `manage_event_types` | ✅ | | | | | |
| `manage_positions` | ✅ | | | | | |

> **SuperAdmin** bypasses this matrix entirely — all permissions in all branches. There is **no** `is_super_admin` column on `profiles` (dropped in migration `00004`); the permission engine (`getUserPermissions()` / `canApproveRegistrations()` in `src/utils/auth/permissions.ts`) checks `session.isSuperAdmin` and returns the wildcard `['*']` instead of resolving positions/grants. See §1.7 for how that session flag is derived.

---

## 9. Key Query Patterns

### Check if user is SuperAdmin
SuperAdmin status is **not** a queryable column — it's resolved at sign-in by bcrypt-comparing the user's email against every `superadmins.hashed_email` row, then cached onto the session as `isSuperAdmin`. There is no single indexed lookup because bcrypt hashes can't be matched with `WHERE hashed_email = ...`.

```ts
// src/utils/auth/superadmin.ts
// Pure, unit-testable matcher — bcrypt-compares the email against each row.
export async function matchesSuperAdmin(
  email: string,
  rows: { hashed_email: string }[]
): Promise<boolean> {
  for (const row of rows) {
    if (await bcrypt.compare(email, row.hashed_email)) return true
  }
  return false
}

// IO wrapper — fetches the superadmins rows (service role) then delegates. Memoized per request.
export const isSuperAdmin = cache(async (email: string | null | undefined): Promise<boolean> => {
  if (!email) return false
  const supabase = createAdminClient()
  const { data } = await supabase.from('superadmins').select('hashed_email')
  if (!data || data.length === 0) return false
  return matchesSuperAdmin(email, data)
})
```

Downstream, once `session.isSuperAdmin` is set, every permission check is a cheap in-memory read:
```ts
// src/utils/auth/permissions.ts
const session = await auth()
if (session?.isSuperAdmin) return ['*']
```

### Get all permissions for a user in a branch
```sql
-- Combines position-based + direct grants
SELECT DISTINCT p.name
FROM memberships m
JOIN position_permissions pp ON m.position_id = pp.position_id
JOIN permissions p ON pp.permission_id = p.id
WHERE m.profile_id = $1
  AND m.branch_id = $2
  AND m.ended_at IS NULL

UNION

SELECT p.name
FROM member_permissions mp
JOIN permissions p ON mp.permission_id = p.id
WHERE mp.profile_id = $1
  AND mp.branch_id = $2
  AND mp.revoked_at IS NULL;
```

### Fetch all active members in a branch
```sql
SELECT m.*, p.full_name, p.email, pos.name AS position_name
FROM memberships m
JOIN profiles p ON m.profile_id = p.id
LEFT JOIN positions pos ON m.position_id = pos.id
WHERE m.branch_id = $1 AND m.ended_at IS NULL
ORDER BY pos.name, p.full_name;
```

### Historical lookup: past Chairs of CS branch
```sql
SELECT p.full_name, m.assigned_at, m.ended_at
FROM memberships m
JOIN profiles p ON m.profile_id = p.id
JOIN positions pos ON m.position_id = pos.id
WHERE m.branch_id = $1
  AND pos.name = 'Chair'
ORDER BY m.assigned_at DESC;
```

### Pending registrations queue (for admin/MDO)
```sql
SELECT id, full_name, email, ieee_membership_id, section, created_at
FROM profiles
WHERE status = 'pending'
ORDER BY created_at ASC;
```

### Check if a membership ID is pre-approved
```sql
SELECT id FROM pre_approved_members
WHERE ieee_membership_id = $1;
```

---

## 10. Migration History

| Migration | Description | Key Changes |
|-----------|-------------|-------------|
| `00001_initial_schema.sql` | Foundation schema | Created all core tables: profiles, branches, positions, memberships, events, event_types, event_approvals, event_audit_log, membership_audit_log. Seeded branches, positions, and event types. |
| `00002_permission_system.sql` | Permission-based access + registration gating | Dropped `portal_role` enum and `can_create_events` column. Added `permissions`, `position_permissions`, `member_permissions`, `pre_approved_members` tables. Added registration fields to `profiles` (`ieee_membership_id`, `status`, `is_super_admin`, etc.). Seeded MDO position and full permission matrix. |
| `00003_nextauth_migration.sql` | Decouple auth from Supabase `auth.users` | Added `profiles.password_hash` for email/password users. Dropped the `on_auth_user_created` trigger and the `profiles_id_fkey` FK to `auth.users` (auth is now owned by NextAuth/Auth.js, Supabase is database-only). Set `profiles.id` to self-generate via `gen_random_uuid()`. |
| `00004_invisible_superadmin.sql` | Move SuperAdmin off `profiles` | Created `superadmins` table (bcrypt-hashed emails + passphrase hash), RLS enabled with no public policies. **Dropped `profiles.is_super_admin`.** Seeded the initial SuperAdmins. (The `passphrase_hash` column was for a since-removed `/sudo` elevation flow and is no longer read by the app — see §1.7.) |
| `00005_new_positions.sql` | Seed additional standard positions | Added `Web Master`, `Treasurer`, `Technical Associate`, `Marketing Associate` positions to every branch, with baseline `view_members` (and `create_events` for Web Master/Treasurer) permissions. |
| `00006_workspace_and_requests.sql` | Position requests + notifications | Added `profiles.bio`/`profiles.skills`. Added `position_request_status` enum and `position_requests` table (member-initiated requests to hold a position). Added `notifications` table. |
| `00007_notification_types.sql` | Notification categorization | Added `notifications.type` column (`normal`, `broadcast`, `success`, `warning`, `error`). |
| `00008_audit_log.sql` | Unified SuperAdmin audit trail | Added `audit_log` table (documented in §4.14) with indexes on `created_at`, `actor_profile_id`, and `(entity_type, entity_id)`. RLS enabled with no public policies (service-role only). Records structural/super-admin actions taken via the SuperAdmin portal. |
| `00009_broadcast_notifications.sql` | Broadcast notifications | Made `notifications.profile_id` nullable, added CHECK constraint `notifications_recipient_check`, enabled RLS with SELECT policy, and added `notifications`, `profiles`, `memberships` to the `supabase_realtime` publication. |
| `00010_hardcoded_superadmin_profile.sql` | Backing profile for the fixed super-admin login | Seeds a `profiles` row with the synthetic id `11111111-1111-1111-1111-111111111111` (= `SUPERADMIN_ID` in `src/auth.ts`) so writes that FK-reference the acting admin (audit logs, `assigned_by`, `granted_by`) resolve. Login never reads this row — it exists purely for referential integrity. |
| `00011_notification_routing.sql` | Notification routing + Chair visibility | Added `notifications.audience`/`branch_id`/`event_key`/`actor_profile_id`; replaced `notifications_recipient_check` with `notifications_audience_check`; replaced the RLS SELECT policy with `read own, broadcast, or chair-branch`; added branch/created/event indexes; backfilled legacy `type='broadcast'` rows to `audience='broadcast', type='info'`. See [features/notifications.md](features/notifications.md). **Apply manually in Supabase.** |
