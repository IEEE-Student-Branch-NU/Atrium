# Feature: Position Requests

> How a member asks to hold a position, and how an admin (or super-admin) decides. This is the "promotion request" flow.

---

## The flow

```
member (About Me) ──▶ requestPosition ──▶ position_requests (status: pending)
                                             │  notifyBranch → the branch's Chair(s)
admin (/position-requests) or                │
super-admin (/superadmin/position-requests) ─┤
   ├─ approve ──▶ INSERT memberships row  +  request → approved  ✉️ position_request.approved
   └─ reject  ──▶ request → rejected (+ reason)                  ✉️ position_request.rejected
```

## File map

| File | Role |
|------|------|
| `src/app/(portal)/profile/actions.ts` `requestPosition` | Member submits a request (from the About Me page). |
| `src/app/(portal)/position-requests/page.tsx` | Admin queue, gated on `manage_positions`. |
| `src/app/(portal)/position-requests/actions.ts` | `approvePositionRequest`, `rejectPositionRequest` — **shared** with the super-admin console. |
| `src/app/(portal)/position-requests/client.tsx` | Approve dialog (optional comment) + Reject dialog (required reason). |
| `src/app/superadmin/(dashboard)/position-requests/*` | Super-admin queue + decided-history; reuses the same actions. |

## Submission (`requestPosition`)

Validates branch + position + reason (≥10 chars), **dedupes** against an existing pending request and against an already-held membership, inserts the `position_requests` row, then `notifyBranch({ event: 'position_request.submitted' })` so the branch's Chair(s) see it in their [branch-activity feed](notifications.md).

## Decision (`approvePositionRequest` / `rejectPositionRequest`)

- **Super-admin bypass:** if `session.isSuperAdmin`, workspace/permission resolution is skipped entirely — the decision operates on the *request's own* branch/position, which is safe. Otherwise the actor must hold `manage_positions` and be in the **same branch** as the request (cross-branch guard).
- **Approve:** re-checks status; if the user already holds the position, closes the request and throws; otherwise **inserts a new `memberships` row** (append-only — never mutates), sets the request `approved`, `notifyUser('position_request.approved')`, writes `membership_audit_log` `membership_assigned`, and for super-admins also `logAdminAction`.
- **Reject:** requires a reason, sets `rejected` + `admin_comment`, `notifyUser('position_request.rejected', { reason })`.

> These actions **throw on failure** (rather than returning `{ error }`). The super-admin `request-controls.tsx` wraps them in try/catch and converts to a toast — a deliberate convention mismatch called out in the code. See [../ENGINEERING.md](../ENGINEERING.md).

## Gotchas

- **The admin queue filters by branch *name*, not id**, and only when the actor isn't a wildcard holder: `requests.filter(r => r.branch_name === profile.branch_name)`. The code comment flags this as provisional (`getPendingPositionRequests` fetches all branches). Prefer branch **id** if you harden this.
- Super-admin instrumentation (the `logAdminAction` call) is **additive only** — guarded by `if (session.isSuperAdmin)` so it never affects the branch-admin path.
- Approvals create a *new* active membership; they never edit an existing one (append-only history).

## How to extend

- To notify the requester's Chair on decision too, add a `notifyBranch` call in the decision actions.
- To branch-scope the queue properly, filter `getPendingPositionRequests` by `branch_id` for non-super-admins.
