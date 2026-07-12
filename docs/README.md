# Atrium — Developer Documentation

> **Start here.** This is the map of Atrium's internal docs — written to be read *when you're stuck*. Each doc covers **what** a thing does, **how** it's engineered, **why** it's built that way, and the **gotchas**.
>
> Atrium is the internal portal for the **IEEE Student Branch of Nirma University**: members, branches, positions, permissions, notifications, and a super-admin console. (An Events module is in the DB but [not yet built](features/events.md).)

---

## 🚀 New here? Read in this order

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** — the 10,000-foot view: stack, request lifecycle, Edge/Node split, directory map.
2. **[DEVELOPMENT.md](DEVELOPMENT.md)** — run it locally: every env var, how to apply migrations, how to verify.
3. **[ENGINEERING.md](ENGINEERING.md)** — the conventions to copy and the traps to avoid.
4. Then dive into whatever you're touching (below).

## 📚 Core references

| Doc | Covers |
|-----|--------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, request flow, directory map |
| [ENGINEERING.md](ENGINEERING.md) | Conventions, patterns, gotchas, "add a feature" recipe |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup, env vars, migrations, verification |
| [AUTH.md](AUTH.md) | Identity: NextAuth, Google/credentials, super-admin, session, middleware |
| [PERMISSIONS.md](PERMISSIONS.md) | Positions + permissions + memberships; how access is computed |
| [SCHEMA.md](SCHEMA.md) | Every table, enum, index, migration; the reasoning behind each |

## 🧩 Feature deep-dives ([features/](features/))

| Doc | The screen(s) / system |
|-----|------------------------|
| [portal-dashboard.md](features/portal-dashboard.md) | Portal shell, dashboard home, analytics |
| [registrations-approvals.md](features/registrations-approvals.md) | Signup → approval; `/approvals`, `/pre-approved` |
| [position-requests.md](features/position-requests.md) | Requesting & deciding positions (promotions) |
| [members.md](features/members.md) | Members directory + About Me/profile |
| [notifications.md](features/notifications.md) | The notification system (in-app + email, routing, Chair feed) |
| [workspace-switching.md](features/workspace-switching.md) | Role Switcher (a user's own memberships) |
| [impersonation.md](features/impersonation.md) | Super-admin "Open Workspace" |
| [superadmin-portal.md](features/superadmin-portal.md) | The `/superadmin` console (all pages + actions) |
| [events.md](features/events.md) | ⚠️ Modelled but **not built** — status + how to build it |

## 🗺️ "I want to change X" → go to

| I'm touching… | Read |
|---------------|------|
| Login, sessions, super-admin, middleware | [AUTH.md](AUTH.md) |
| Who-can-do-what | [PERMISSIONS.md](PERMISSIONS.md) |
| A database table / a migration | [SCHEMA.md](SCHEMA.md) |
| A member-facing screen | the matching [features/](features/) doc |
| The super-admin console | [superadmin-portal.md](features/superadmin-portal.md) |
| Notifications or email | [notifications.md](features/notifications.md) |
| Anything (conventions first) | [ENGINEERING.md](ENGINEERING.md) |

## ⚠️ Repo-wide truths worth memorizing

- **NextAuth owns auth; Supabase is just Postgres.** All server DB access uses the service-role admin client and **bypasses RLS**. Authorization is in code.
- **RLS matters only for the browser Realtime path** (notifications). Only `notifications`, `superadmins`, `audit_log` have RLS.
- **Migrations are applied by hand** in the Supabase SQL editor — code degrades gracefully when one isn't applied.
- **Permissions are workspace-scoped** and never merged across branches.
- **Side effects (notify/email/audit) are best-effort** — they never break the action.
- **Verify with `npm run build && npm test`** (not lint).
- **Events is unbuilt; `/events` and portal `/audit` nav links are dead; `graphify-out/` doesn't exist.** Don't be surprised.

## 📎 Also in this folder

- `superpowers/specs/` — design specs (e.g. the [super-admin portal](superpowers/specs/2026-07-08-super-admin-portal-design.md) and [notification system](superpowers/specs/2026-07-12-notification-system-design.md)) with historical rationale.
- `superpowers/plans/` — phased implementation plans.

*Docs reflect the codebase as of July 2026. If something here contradicts the code, the code wins — please fix the doc.*
