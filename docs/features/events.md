# Feature: Events — **Not Yet Built** (status & how to build it)

> ⚠️ **Honesty note.** Despite the project's original name ("Event Creation Portal") and the presence of a rich `events` data model, **there is no working Events feature in the app today.** This page documents the real state so nobody wastes time looking for code that isn't there.

---

## What actually exists

| Layer | State |
|-------|-------|
| **Database** | ✅ Fully modelled — `events`, `event_types`, `event_approvals`, `event_audit_log` (migration `00001`), plus the `event_status` and `approval_decision` enums and seeded event types. See [../SCHEMA.md](../SCHEMA.md). |
| **Permissions** | ✅ Defined — `create_events`, `approve_events`, `manage_events`, `manage_event_types` exist and are mapped to positions. |
| **Nav links** | ⚠️ Present but dead — `/events`, `/events/create`, `/events/approvals` are linked in the portal sidebar and dashboard. |
| **Routes/pages** | ❌ None — there is **no `src/app/(portal)/events/` directory**. |
| **Server actions** | ❌ None — no `createEvent`/`submitEvent`/`approveEvent`/`publishEvent` anywhere in `src`. |
| **Notifications** | ⚠️ Catalog-ready, unwired — `event.submitted/approved/rejected/published` exist in `src/lib/notifications/events.ts` but are explicitly marked **deferred** (no actions to fire them). |
| **Reads** | The only live touch is `getDashboardStats` counting `events` by status — so those dashboard counts are ~always 0. |

## Intended design (from the schema)

The data model implies this lifecycle:

```
draft → pending_approval → approved → published
                        ↘ rejected
```

- `events` — one row per event (branch-scoped, `creator_id`, `event_type_id`, banner JSONB for ImageKit, capacity, location, status).
- `event_approvals` — one row per approval **level** (level 1 = branch admin, level 2 = SBNU admin), `UNIQUE(event_id, level)`.
- `event_audit_log` — immutable lifecycle log; `event_id` is deliberately **not** a FK so entries survive hard deletes.
- Events are **hard-deleted**; the audit log keeps a JSONB snapshot.

## How to build it (checklist)

1. **Routes/pages** under `src/app/(portal)/events/`:
   - `page.tsx` — "My Events" list (`events` where `creator_id = me` or branch-scoped).
   - `create/page.tsx` + client — create form (gated `create_events`).
   - `approvals/page.tsx` + client — approval queue (gated `approve_events`).
2. **`events/actions.ts`** (`'use server'`) — `createEvent` (draft), `submitEvent` (→ pending_approval), `approveEvent`/`rejectEvent` (write `event_approvals` + status), `publishEvent`, `deleteEvent` (snapshot to `event_audit_log`). Re-check permissions server-side (copy the `approvals/actions.ts` pattern).
3. **Queries** in `src/lib/queries.ts` — `getEventsForBranch`, `getEventApprovalQueue`, `getEvent`, etc.
4. **Wire notifications** — the catalog entries already exist; call `notifyBranch('event.submitted')` to alert approvers and `notifyUser('event.approved'/'event.rejected'/'event.published')` for the creator. Flip them from "deferred" once actions exist.
5. **Image upload** — the `events.banner` JSONB expects ImageKit metadata (`{ url, file_id, width, height, format }`); wire an uploader.
6. **UI primitives** — note the kit currently lacks `form`, `popover`, `command`, `calendar` primitives (see [../ENGINEERING.md](../ENGINEERING.md)); you'll likely add a date picker.

## Gotchas for the implementer

- The nav links already exist, so users can currently click into 404s — either build the pages or hide the links until ready.
- `getDashboardStats` and `getRecentActivity` already read `events`/`event_audit_log`; they'll start showing real data automatically once events are created.
- Follow **append-only / audit** conventions: write `event_audit_log` on every lifecycle transition.
