# Notification System — Design Spec

- **Status:** Draft for review
- **Date:** 2026-07-12
- **Author:** Atrium team (via Claude Code brainstorming)
- **Depends on:** existing `notifications` table (migrations 00006/00007/00009), realtime stack, super-admin portal (00008/00010)

---

## 1. Overview

Atrium already ships a working in-app notification stack: a `notifications` table, Supabase Realtime delivery, `sonner` toasts, a `/notifications` page, a top-bar bell with an unread badge, and a super-admin broadcast dialog. Today two automated triggers exist (position-request approved / rejected) and notifications are **only** ever seen by their single recipient or, for broadcasts, everyone.

This project **extends** that stack rather than rebuilding it. It adds three capabilities:

1. **Super-admin oversight + targeted send** — a read-only feed of every notification circulating org-wide (filterable), plus the ability to send a notification to a specific user, a branch's Chairs, or everyone.
2. **Club-level (Chair) visibility** — the Chair of a branch (SBNU / CS / ITSS / WIE / SIGHT / SPS) sees branch-scoped *activity* notifications for their branch.
3. **A broad automated-trigger catalog** — welcome, approvals/rejections, promotions/role changes, and lifecycle/admin events — delivered **in-app always** and **by email for a curated high-signal subset**.

A secondary goal is to **centralize** notification creation. Today the insert logic is copy-pasted across ~5 server actions with two divergent broadcast implementations; this spec introduces one service so new events and email routing live in a single, testable place.

### Goals
- Add branch/audience **routing** to notifications without a new table.
- Give the super-admin a filterable oversight feed and a 3-way targeted send.
- Give Chairs a live, branch-scoped activity feed (without exposing members' private notifications).
- Add the automated triggers listed in §6, each with a defined severity, audience, and channel set.
- Consolidate all notification writes behind one `notify()` service, and reconcile the two broadcast paths.

### Non-goals / YAGNI (this phase)
- No per-user notification **preferences / mute settings** (all opted-in).
- No digest / batching of emails (each qualifying event = one email).
- No SMS / push / Slack channels.
- No notification "recall/delete" or moderation (super-admin *sends and observes*, does not retract). *(This was offered and not selected.)*
- No cross-branch aggregation for non-Chair admins — visibility is **Chair position only**, per decision.

---

## 2. Locked decisions (with rationale)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Extend the existing `notifications` table**, no new table. | The table, RLS, realtime publication, and read layer already exist; adding columns is lower-risk than a parallel table. |
| D2 | **Super-admin scope = oversight feed + send-to-anyone** (user / branch-Chairs / broadcast). No recall/moderation. | Chosen in brainstorming. Matches the "all messages circulating" framing; keeps write surface small. |
| D3 | **Club admin = the `Chair` position only**, seeing **branch activity** (not members' private notifications). | Chosen in brainstorming. `Chair` is already the branch's all-permissions position; simplest unambiguous gate. |
| D4 | **Delivery = in-app (always) + email (curated subset)** via **Resend**, graceful no-op when unconfigured. | Chosen in brainstorming. Resend fits the Next/Vercel stack; no-op keeps dev/build/CI working without an API key. Email limited to high-signal events to avoid fatigue. |
| D5 | **Decouple routing (`audience`) from styling (`type`).** | Today `type='broadcast'` overloads both "who" and "how it looks". Separating them lets a broadcast be `type='info'` and unblocks branch routing. |
| D6 | **Centralized `notify()` service + typed event catalog.** | Removes the current 5× duplication and the two divergent broadcast impls; single place to add email + new events. |
| D7 | **Chair realtime via RLS**, using the existing minted JWT (`sub = profileId`). | The realtime path already relies on RLS + the minted token; a branch-visibility policy gives Chairs live toasts with no new token claims. |

---

## 3. Current state (what we build on)

- **Table** `public.notifications`: `id, profile_id (nullable), title, message, link, is_read, type, created_at`. `type ∈ {normal, broadcast, success, warning, error}`. CHECK: `type='broadcast' ⇔ profile_id IS NULL`. In the `supabase_realtime` publication. RLS SELECT: `auth.uid()::text = profile_id::text OR type='broadcast'`.
- **Read layer** `src/lib/queries.ts`: `Notification` interface, `getUnreadNotifications`, `getNotifications`.
- **Delivery** `src/components/providers/realtime-notifications-provider.tsx` (subscribes to INSERT, toasts by `type`, `router.refresh()`), authed by the minted JWT from `src/utils/supabase/token.ts`.
- **Writes today** (to be routed through the new service):
  - `src/app/(portal)/position-requests/actions.ts` — approved (line ~100) / rejected (line ~196) inserts.
  - `src/app/(portal)/notifications/actions.ts` — `sendBroadcast` (bulk one-row-per-profile).
  - `src/app/superadmin/actions.ts` — `sendBroadcastMessage` (single `profile_id=NULL` row). **These two diverge and must be reconciled.**
- **Trigger gaps** (no notification today): registration approve/reject (`approvals/actions.ts`), signup/welcome (`auth/actions.ts`), super-admin `assignPosition`/`grantPermission`/`revokePermission`.
- **Roles:** no role enum for clubs — a "Chair" holds an active `memberships` row whose `position` name is `Chair`; `isSuperAdmin` is a session flag. Active workspace = `atrium_workspace_id` cookie → a membership → a branch.

---

## 4. Data model — migration `00011_notification_routing.sql`

> Migrations are applied **manually in the Supabase dashboard** (project convention). The migration file is authored and committed but not auto-run.

Add columns to `public.notifications`:

| Column | Type | Notes |
|--------|------|-------|
| `audience` | `TEXT NOT NULL DEFAULT 'user'` | routing target: `'user' \| 'branch' \| 'broadcast'` |
| `branch_id` | `UUID REFERENCES branches(id)` | nullable; the club context for filtering/visibility |
| `event_key` | `TEXT` | nullable; machine key of the trigger (see §6) |
| `actor_profile_id` | `UUID REFERENCES profiles(id)` | nullable; who caused it (system = null) |

`type` is **retained as severity only**: `'normal' | 'info' | 'success' | 'warning' | 'error'`. (`'broadcast'` is no longer a `type` value for new rows; see backfill below.)

**Constraint** — drop `notifications_recipient_check`, replace with:

```sql
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_audience_check CHECK (
    (audience = 'user'      AND profile_id IS NOT NULL) OR
    (audience = 'branch'    AND branch_id IS NOT NULL AND profile_id IS NULL) OR
    (audience = 'broadcast' AND profile_id IS NULL)
  );
```

**Migration step order (must be exact):** (1) add the four columns, (2) backfill, (3) drop the old CHECK, (4) add the new CHECK, (5) drop+recreate the RLS policy, (6) add indexes. Backfilling before swapping the constraint avoids a transient constraint violation.

**Backfill** existing rows: `UPDATE notifications SET audience='broadcast' WHERE type='broadcast';` then `UPDATE notifications SET type='info' WHERE type='broadcast';` (order matters — set `audience` first, since the second statement still filters on `type='broadcast'`). Rows with a `profile_id` keep the `audience='user'` default.

**Indexes:**
```sql
CREATE INDEX idx_notifications_branch_created ON notifications(branch_id, created_at DESC) WHERE audience='branch';
CREATE INDEX idx_notifications_created ON notifications(created_at DESC); -- super-admin feed
CREATE INDEX idx_notifications_event ON notifications(event_key);
```

**RLS** — replace the SELECT policy so Chairs also see their branch's activity (super-admin reads use the service-role client and bypass RLS):

```sql
DROP POLICY IF EXISTS "Users can read own or broadcast notifications" ON public.notifications;
CREATE POLICY "read own, broadcast, or chair-branch" ON public.notifications
  FOR SELECT USING (
    (audience = 'broadcast')
    OR (audience = 'user'   AND auth.uid()::text = profile_id::text)
    OR (audience = 'branch' AND EXISTS (
          SELECT 1 FROM memberships m
          JOIN positions p ON p.id = m.position_id
          WHERE m.profile_id = auth.uid()
            AND m.branch_id  = notifications.branch_id
            AND m.ended_at IS NULL
            AND p.name = 'Chair'))
  );
```

This works with the existing minted JWT (`sub = profileId = auth.uid()`), so **no token changes** are required and Chairs receive branch notifications over the websocket automatically.

---

## 5. Notification service — `src/lib/notifications/`

A new server-only module; the single write path for all notifications.

- **`events.ts` — the event catalog.** A typed record keyed by `event_key`. Each entry declares: `audience`, `type` (severity), `channels` (`['in_app']` or `['in_app','email']`), a `title`, a `render(params) → message` template, and an optional `link(params)`. This is the source of truth for §6.
- **`notify.ts`** (server-only, imports `createAdminClient`):
  - `notifyUser({ profileId, event, params, actorProfileId?, branchId? })`
  - `notifyBranch({ branchId, event, params, actorProfileId? })` — one `audience='branch'` row; visible to that branch's Chairs (and super-admin).
  - `notifyBroadcast({ event | custom, actorProfileId })` — one `audience='broadcast'` row.
  - `notifyCustom({ ...raw })` — escape hatch for the super-admin free-form send (title/message/type/target chosen in UI, no catalog entry).
  - Each function: insert the row(s); if `channels` includes `email`, resolve recipient email(s) and call `sendEmail` **best-effort** (try/catch, never throws into the caller — mirrors `logAdminAction`).
  - Email-recipient resolution: `user` → the profile's email; `branch` → emails of active Chairs of that branch; `broadcast` → **in-app only, never email** (avoids org-wide email blasts).
- **`email.ts`** — wraps Resend. Reads `RESEND_API_KEY` + `EMAIL_FROM`. If `RESEND_API_KEY` is unset, logs and returns (**no throw**), so local/dev/CI runs unaffected.
- **`templates.ts`** — minimal HTML per email-enabled event (title, body, CTA link back to Atrium).

**Refactor:** the existing inline inserts (position-request approve/reject) and both broadcast paths are rewritten to call this service. `sendBroadcast` (per-profile bulk) is removed in favor of the single-row broadcast; the super-admin dialog and portal broadcast both go through `notifyBroadcast`/`notifyCustom`.

---

## 6. Automated trigger catalog

In-app for all; **✉️ = also email**. Each maps to an `event_key`, an audience, and a call site.

### 6.1 Welcome / onboarding
| event_key | Audience | Type | Email | Trigger site |
|-----------|----------|------|:---:|--------------|
| `welcome` | user | success | ✉️ | `auth/actions.ts` `signUp` / `completeRegistration` (after profile create) |
| `membership.added` | user | info | | `auth/actions.ts` / `superadmin/actions.ts` when first membership assigned |

### 6.2 Approvals & rejections
| event_key | Audience | Type | Email | Trigger site |
|-----------|----------|------|:---:|--------------|
| `registration.approved` | user | success | ✉️ | `approvals/actions.ts` `approveRegistration` *(gap today)* |
| `registration.rejected` | user | error | ✉️ | `approvals/actions.ts` `rejectRegistration` *(gap today)* |
| `position_request.submitted` | branch | info | | `position-requests/actions.ts` create → Chair(s) of branch |
| `position_request.approved` | user | success | ✉️ | `position-requests/actions.ts` `approvePositionRequest` *(exists → refactor)* |
| `position_request.rejected` | user | error | ✉️ | `position-requests/actions.ts` `rejectPositionRequest` *(exists → refactor)* |

### 6.3 Promotion / role & position change
| event_key | Audience | Type | Email | Trigger site |
|-----------|----------|------|:---:|--------------|
| `member.promoted` | user | success | ✉️ | `superadmin/actions.ts` `assignPosition` (new position → "You're now {position} of {branch}") |
| `member.position_removed` | user | warning | | `superadmin/actions.ts` `removePosition` |
| `permission.granted` | user | info | | `superadmin/actions.ts` `grantPermission` |
| `permission.revoked` | user | warning | | `superadmin/actions.ts` `revokePermission` |

### 6.4 Lifecycle / admin
| event_key | Audience | Type | Email | Trigger site |
|-----------|----------|------|:---:|--------------|
| `event.submitted` | branch | info | | event submit action → Chair (approver) of branch |
| `event.approved` | user | success | | event approval action → creator |
| `event.rejected` | user | error | | event approval action → creator |
| `event.published` | user | success | | publish action → creator |
| `broadcast.custom` | broadcast | info | | super-admin send dialog |

> **Trim list:** the reviewer may drop any row. Email column is independently editable. Event-lifecycle rows (§6.4) depend on the event submit/approve/publish actions existing; if any action is absent in the current code, that trigger is deferred and noted in the plan.

---

## 7. Super-admin oversight + send — `/superadmin/notifications`

New nav item under the super-admin dashboard.

- **Feed** (`page.tsx` + `queries.ts`): server-rendered list of **all** notifications via the service-role client (RLS bypassed). Columns: time, audience, branch, type, event_key, recipient/target, title, read state. **Filters:** branch, audience, type, event_key, read/unread, date range, free-text search on title/message. Paginated.
- **Send dialog** (`send-notification-dialog.tsx`, replaces/absorbs `send-broadcast-dialog.tsx`): target selector —
  - **User** (searchable profile picker) → `notifyCustom` audience `user`.
  - **Branch Chairs** (branch picker) → `notifyCustom` audience `branch`.
  - **Everyone** → `notifyBroadcast`/`notifyCustom` audience `broadcast`.
  - Fields: title, message, type (severity), optional link. All sends write an `audit_log` entry (`action='notification_sent'`) as the current broadcast does.

---

## 8. Chair branch feed — portal `/notifications`

- The existing `/notifications` page gains a **"Branch activity" tab** rendered **only when the active-workspace membership's position is `Chair`** (resolved from the layout's already-fetched workspace/permission data — no extra round trip in the common case).
- The tab lists `audience='branch'` rows for the Chair's branch (`getBranchNotifications(branchId)` in `queries.ts`).
- Because of the RLS change (§4), these INSERTs also reach the Chair over the websocket, so the realtime provider shows them as live toasts. The provider's toast switch keys off `type` (unchanged); branch rows carry a normal severity.
- Members who are not Chairs see no branch tab and no branch toasts. Private (`audience='user'`) notifications of other members are never exposed.

---

## 9. Email (Resend)

- Add dependency `resend`. Env: `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Atrium <no-reply@…>`). Document in `.env.example` / README.
- `email.ts` sends only for events whose catalog `channels` include `email` (§6). Best-effort; failures are logged, never surfaced to the user or allowed to fail the action.
- Recipients: `user` events → that user's email; `branch` events → active Chairs' emails; broadcasts → in-app only.
- When `RESEND_API_KEY` is absent (dev/CI), `email.ts` is a logging no-op — the app and tests behave identically minus the outbound email.

---

## 10. Backward compatibility & reconciliation

- Existing rows are backfilled to the new `audience`/`type` scheme (§4). The old CHECK is dropped and replaced.
- The realtime provider and `/notifications` list continue to render existing rows; `type='broadcast'` legacy rows become `audience='broadcast', type='info'` and still render/deliver.
- The `Notification` TS interface in `queries.ts` gains `audience`, `branch_id`, `event_key`, `actor_profile_id`; `type` union updated to include `info` and drop `broadcast`.
- The two broadcast code paths converge on `notifyBroadcast` (single row). `sendBroadcast` (per-profile bulk) is deleted.

---

## 11. Security considerations

- **RLS is the guard for the realtime/browser path only**; all server reads/writes use the service-role client. The new branch policy must correctly scope Chairs (join on active `Chair` membership) — unit-tested via the visibility helper.
- Super-admin feed and send are gated by the existing `requireSuperAdmin()` / session `isSuperAdmin` checks, same as the current broadcast.
- The Chair branch tab is gated server-side by the active membership's position, not by a client flag.
- `notifyCustom` (free-form super-admin send) must sanitize/trim title/message and enforce the audience/target invariants before insert.
- Email sends never expose one user's notification content to another (recipient resolution is per-target).

---

## 12. Verification approach

Per project convention, verify with **build + test** (not lint); migrations applied manually in Supabase.

- **Unit (vitest):**
  - Event catalog: every `event_key` resolves to a valid `{title, message}` for representative params; every entry has a valid `audience`/`type`/`channels`.
  - `notify()` routing: `notifyUser/Branch/Broadcast/Custom` produce rows satisfying the `notifications_audience_check` invariants (profile_id/branch_id nullness by audience).
  - Chair-visibility helper: given memberships, returns branch-visible set correctly (Chair vs non-Chair vs cross-branch).
  - `email.ts` no-ops (no throw) when `RESEND_API_KEY` unset.
- **Build:** `npm run build` clean (types updated for the new columns).
- **Manual smoke (after applying 00011 in Supabase):** trigger a registration approve, a position promotion, and a super-admin targeted send; confirm in-app toast for the recipient, the Chair branch tab updates for a branch event, and the super-admin feed shows all three.

---

## 13. File-change summary

**New**
- `supabase/migrations/00011_notification_routing.sql`
- `src/lib/notifications/{events,notify,email,templates}.ts`
- `src/lib/notifications/__tests__/*.test.ts`
- `src/app/superadmin/(dashboard)/notifications/{page,queries}.tsx` + `send-notification-dialog.tsx`
- `getBranchNotifications` in `src/lib/queries.ts`; Chair "Branch activity" tab in `src/app/(portal)/notifications/{page,client}.tsx`

**Modified**
- `src/lib/queries.ts` — `Notification` interface (+`audience`,`branch_id`,`event_key`,`actor_profile_id`; `type` union).
- `src/app/(portal)/position-requests/actions.ts` — route approve/reject/submit through `notify()`.
- `src/app/(portal)/approvals/actions.ts` — add `registration.approved/rejected`.
- `src/app/auth/actions.ts` — add `welcome` / `membership.added`.
- `src/app/superadmin/actions.ts` — `assignPosition/removePosition/grantPermission/revokePermission` notifications; broadcast → `notifyBroadcast`.
- `src/app/(portal)/notifications/actions.ts` — remove `sendBroadcast`; keep mark-read.
- `src/components/superadmin/sidebar.tsx` — add Notifications nav item.
- `types/*` / `.env.example` / README — email env vars.

**Removed**
- `sendBroadcast` (per-profile bulk) and `send-broadcast-dialog` superseded by the unified send dialog.

---

## 14. Assumptions to confirm during implementation

1. **Event lifecycle actions** (submit/approve/publish) exist as server actions to hook §6.4 into; if partially missing, those triggers are deferred (noted, not silently dropped).
2. A branch may have **multiple active Chairs**, or none — `notifyBranch` handles 0..n Chair emails gracefully; a branch row is still created even with no Chair (visible to super-admin).
3. `EMAIL_FROM` domain is verified in Resend before email is enabled in production; until then email no-ops.
4. The active-workspace position is available to the `/notifications` page without an extra query (via the portal layout's existing resolution); if not, one scoped query is acceptable.
