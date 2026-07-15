# Feature: Notifications

> In-app + email notifications with role-scoped routing, a super-admin oversight console, a Chair branch-activity feed, and an automated trigger catalog.
> **Design spec:** [../superpowers/specs/2026-07-12-notification-system-design.md](../superpowers/specs/2026-07-12-notification-system-design.md) · **Schema:** [../SCHEMA.md](../SCHEMA.md) §4.15 · **Migration:** `00011_notification_routing.sql`

---

## What it does

- Delivers **in-app** notifications (list at `/notifications`, top-bar bell badge, live **realtime toasts**) and **email** for a curated high-signal subset.
- **Routes** each notification to one of three audiences: a single **user**, a **branch** (visible to that branch's Chairs), or **everyone** (broadcast).
- Fires **automated** notifications on real events (welcome, registration approve/reject, position-request submit/approve/reject, promotion, permission changes).
- Gives super-admins a **filterable oversight feed of every notification** plus a **send-to-anyone** dialog.
- Gives a branch **Chair** a "Branch activity" tab for their branch.

## Two dimensions (the core idea)

Migration `00011` split what used to be one overloaded column into two:

| Dimension | Column | Values | Meaning |
|-----------|--------|--------|---------|
| **Routing** | `audience` | `user` \| `branch` \| `broadcast` | *who receives / can see it* |
| **Styling** | `type` | `normal` \| `info` \| `success` \| `warning` \| `error` | *how it looks* |

Plus `branch_id` (club context), `event_key` (which trigger), `actor_profile_id` (who caused it). The DB `notifications_audience_check` enforces the nullness rules; the RLS policy `read own, broadcast, or chair-branch` governs the browser realtime path.

## File map

| File | Role |
|------|------|
| `src/lib/notifications/events.ts` | **The event catalog** — single source of truth. Each event: `audience`, `type`, `channels`, `title`, `buildMessage`, `buildLink`. |
| `src/lib/notifications/payload.ts` | Pure row builders (`buildUserRow`/`buildBranchRow`/`buildBroadcastRow`/`buildCustomRow`) + `satisfiesAudienceInvariant` — mirror the DB CHECK. |
| `src/lib/notifications/notify.ts` | **The single write path** (server-only): `notifyUser`, `notifyBranch`, `notifyBroadcast`, `notifyCustom`. Inserts rows + best-effort email. |
| `src/lib/notifications/email.ts` | Fetch-based Resend sender. **No-op when `RESEND_API_KEY`/`EMAIL_FROM` unset** — never throws. |
| `src/lib/notifications/templates.ts` | Minimal HTML email shell (`renderEmail`). |
| `src/lib/notifications/visibility.ts` | `isChairPosition`, `chairBranchIds`, `CHAIR_POSITION_NAME` — mirror the RLS gate for server-side rendering. |
| `src/lib/notifications/index.ts` | Barrel — import triggers from `@/lib/notifications`. |
| `src/lib/notifications/__tests__/*` | 15 unit tests (catalog validity, payload invariants, Chair visibility). |
| `src/lib/queries.ts` | `getNotifications` (personal + broadcast), `getUnreadNotifications` (badge), `getBranchNotifications` (Chair feed). |
| `src/app/(portal)/notifications/{page,client,actions}.tsx` | Member list + Chair tab + `markAsRead`/`markAllAsRead`/`sendBroadcast`. |
| `src/app/superadmin/(dashboard)/notifications/{page,send-notification-dialog}.tsx` | Oversight feed + unified send. |
| `src/app/superadmin/queries.ts` | `getAllNotifications`, `getBranchOptions`, `getRecipientOptions`. |
| `src/components/providers/realtime-notifications-provider.tsx` | Browser realtime → toast + `router.refresh()`. |

## Data flow (a trigger)

```
server action (e.g. approveRegistration)
   └─ notifyUser({ profileId, event: 'registration.approved', params })
        ├─ renderEvent(catalog)              → { title, message, link, type, audience, channels }
        ├─ buildUserRow(...)                 → row (validated against audience invariant)
        ├─ supabase.from('notifications').insert(row)   [service-role]
        │      └─ Postgres INSERT → supabase_realtime → browser socket → RLS filter → toast
        └─ if channels includes 'email' → sendEmail(recipient)   [best-effort]
```

## Automated triggers (what fires today)

In-app always; ✉️ = also email. Wired in the listed server actions:

| event_key | Audience | ✉️ | Fired by |
|-----------|----------|:--:|---------|
| `welcome` | user | ✉️ | `signUp` / `completeRegistration` (`auth/actions.ts`) |
| `registration.approved` / `.rejected` | user | ✉️ | `approvals/actions.ts` |
| `position_request.submitted` | branch → Chairs | | `profile/actions.ts` `requestPosition` |
| `position_request.approved` / `.rejected` | user | ✉️ | `position-requests/actions.ts` |
| `member.promoted` | user | ✉️ | `superadmin/actions.ts` `assignPosition` |
| `member.position_removed` | user | | `superadmin/actions.ts` `removePosition` |
| `permission.granted` / `.revoked` | user | | `superadmin/actions.ts` |
| `broadcast.custom` | broadcast | | super-admin send dialog / portal broadcast |

**Deferred:** the `event.*` catalog entries (`event.submitted/approved/rejected/published`) exist but are **not wired** — there are no event-lifecycle server actions in the app yet (see [events.md](events.md)).

## Key decisions & rationale

- **Extend, don't replace.** The table, realtime publication, and toast provider already existed; `00011` added routing on top.
- **Routing decoupled from styling** — the old `type='broadcast'` overloaded "who" and "how it looks"; splitting them unblocked branch routing and let a broadcast be styled `info`.
- **One write path (`notify.ts`).** Before this, notification inserts were copy-pasted across ~5 actions with two divergent broadcast implementations. Centralizing means new events + email live in one testable place.
- **Best-effort side effects.** A failed notification or email must never break the action that triggered it — every `notify*` is wrapped in try/catch (mirrors `logAdminAction`).
- **Broadcast = single row**, fanned out via the RLS `audience='broadcast'` clause + realtime — not one row per user.
- **Email only for high-signal events**, and **never for broadcasts** (avoids org-wide blasts). Resend via plain `fetch` (no SDK dependency); graceful no-op keeps dev/CI/build green without a key.
- **Chair visibility via RLS**, using the existing minted realtime JWT (`sub`=profileId) — no new token claims needed, and Chairs get live branch toasts for free.

## Gotchas

- **Migration `00011` must be applied manually in Supabase.** Until then, reads select non-existent columns → return empty (they log + degrade), and inserts silently no-op. The app won't crash, but nothing shows.
- **Broadcast/branch rows have no per-user read state** (`is_read` is shared). The badge (`getUnreadNotifications`) counts **personal** unread only, and the client hides "Mark read" on non-`user` rows.
- **Chair tab keys off the *active workspace* position.** If you're Chair of CS but acting in your ITSS member workspace, the tab won't show CS activity until you switch workspace. (RLS would allow it; the UI gate is workspace-scoped by design.)
- **Realtime needs `SUPABASE_JWT_SECRET`** (to mint the browser JWT) and the tables in the `supabase_realtime` publication (done in `00009`).

## How to extend

- **Add an automated notification:** add an entry to `NOTIFICATION_EVENTS` in `events.ts` (pick `audience`, `type`, `channels`), then call `notifyUser/notifyBranch/notifyBroadcast` with the key from the relevant server action. Realtime + toast are automatic; email is automatic if you include `'email'` in `channels`.
- **Turn on email:** set `RESEND_API_KEY` + `EMAIL_FROM` (verified domain). See [../DEVELOPMENT.md](../DEVELOPMENT.md).
- **Add a super-admin send target:** extend `sendNotification` in `superadmin/actions.ts` + the dialog.
