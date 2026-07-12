# Feature: Member Portal Shell, Dashboard & Analytics

> The `(portal)` route group — the shell every member sees, the home dashboard, and the analytics page. Other portal features have their own docs (see the index).

---

## The portal shell — `src/app/(portal)/layout.tsx`

Every portal page renders inside this server-component layout. On each request it:

1. `getEffectiveActor()` → redirect `/login` if not signed in. (Impersonation-aware — see [impersonation.md](impersonation.md).)
2. Resolves the **active workspace**: the impersonation target if impersonating, else the `atrium_workspace_id` cookie.
3. Loads `getUserProfileWithMembership(actingProfileId, activeWorkspaceId)`, `getAllUserMemberships` (for the switcher), **workspace-scoped** permissions (`getUserPermissions(..., profile.membership_id)`), and the unread-notification count.
4. Mints a Supabase realtime JWT (`createSupabaseToken(actingProfileId)`).
5. Renders: `RealtimeNotificationsProvider` → `Sidebar` + (conditional `ImpersonationBanner`) + `TopBar` + `<main>`.

| Component | File | Notes |
|-----------|------|-------|
| Sidebar | `src/components/portal/sidebar.tsx` | Permission-gated nav (`canSee`) + the [Role Switcher](workspace-switching.md). |
| Top bar | `src/components/portal/top-bar.tsx` | Notification bell + unread badge, theme toggle, user menu. |
| Realtime | `src/components/providers/realtime-notifications-provider.tsx` | Subscribes to `notifications` INSERTs → toast + `router.refresh()`. See [notifications.md](notifications.md). |

**Nav sections** (each item may require a permission): Overview (Dashboard) · Events (`/events`, `/events/create`, `/events/approvals` — **all unbuilt**, see [events.md](events.md)) · People (Registrations, Position Requests, Pre-Approved, Members) · Account (About Me, My Positions) · System (Audit Log → **dead link**, Analytics).

> **Gotcha — the top bar always reads "Dashboard".** `TopBar`'s `title` defaults to `'Dashboard'` and the layout never passes a per-page title. Cosmetic; fix by threading a title prop if it matters.

---

## Dashboard home — `/` (`src/app/(portal)/page.tsx`)

- Resolves actor + profile, then permissions **without a membershipId** (`getUserPermissions(supabase, profile.id, profile.branch_id)`), and fetches `getDashboardStats(branch_id)` + `getRecentActivity(8)`.
- Renders a greeting, 4 permission-gated stat cards (Active Members, Pending Approvals, Total Events, Event Approvals), Quick Actions, and a Recent Activity list.

> **Gotcha — permission scoping inconsistency.** The dashboard (and `/approvals`, `/pre-approved`, `/analytics`) resolve permissions **without** passing `membership_id`, hitting the *legacy fallback* in `getUserPermissions` that unions permissions across **all** active memberships in the branch. The **layout/sidebar** and `/position-requests` resolve **workspace-scoped** (with `membership_id`). So the visible nav can disagree with what a page authorizes. When adding pages, prefer passing `profile.membership_id` for correct workspace scoping. (See [../PERMISSIONS.md](../PERMISSIONS.md).)

> **Gotcha — event stats are effectively zero.** `getDashboardStats` reads the `events` table, but nothing in the app ever creates events (see [events.md](events.md)), so Total/Draft/Pending/Published events are 0 unless rows exist externally. Recent Activity reads `event_audit_log`, which is likewise empty in practice.

---

## Analytics — `/analytics`

- **Gated** on `approve_registrations`. Data from `analytics/queries.ts` `getAnalyticsData()`:
  1. **Branch distribution** — active memberships counted by branch.
  2. **Funnel** — all profiles bucketed by `status` (total/pending/approved/rejected).
  3. **30-day registration trend** — last 30 day-buckets tallied from `profiles.created_at`.
- Client renders Recharts stat cards + Line/Bar/Pie charts. No mutations.

> **Gotcha:** the trend query pulls **all** profiles into memory each load and buckets by an `'MMM D'` locale string; a row older than 30 days that collides on month/day is dropped. Fine at current scale; revisit with DB-side aggregation if the user table grows large.

## How to extend

- **New stat card:** add a field to `getDashboardStats` and a `hasPermission`-gated `<Card>`.
- **New chart:** add a query to `analytics/queries.ts` and a Recharts component in `analytics/client.tsx`.
