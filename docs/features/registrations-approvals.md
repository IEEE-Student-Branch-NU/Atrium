# Feature: Registrations, Approvals & Pre-Approval

> How a new member goes from signup to an approved account. Covers `/approvals` (the review queue) and `/pre-approved` (the whitelist). Signup/auth itself is in [../AUTH.md](../AUTH.md).

---

## The lifecycle

```
signup ──▶ profiles.status = 'pending'  (unless pre-approved → 'approved')
   │
   ├─ pre_approved_members has this IEEE ID  ──▶ status = 'approved' immediately  ✉️ welcome
   └─ else ──▶ 'pending' ──▶ admin/MDO reviews at /approvals
                               ├─ approve ──▶ 'approved'  ✉️ registration.approved
                               └─ reject  ──▶ 'rejected'  ✉️ registration.rejected (+ reason)
```

Middleware enforces the gate on every protected request: no IEEE ID → `/complete-registration`; `pending` → `/pending`; `rejected` → `/rejected`; `approved` → portal.

## Registration approvals — `/approvals`

| File | Role |
|------|------|
| `src/app/(portal)/approvals/page.tsx` | Gated on `approve_registrations`. Fetches `getPendingRegistrations()` + `getApprovalHistory(50)`. |
| `src/app/(portal)/approvals/actions.ts` | `approveRegistration(profileId)`, `rejectRegistration(profileId, reason)`. |
| `src/app/(portal)/approvals/client.tsx` | Pending/History tabs; Approve button + Reject dialog (reason required). |

**Actions** (both re-check `approve_registrations` server-side):
- `approveRegistration` — updates `profiles` to `approved` **guarded by `.eq('status','pending')`** (idempotent — a double click can't re-approve), sets `approved_by`/`approved_at`, clears `rejected_reason`. Only if a row actually transitioned does it `notifyUser('registration.approved')`.
- `rejectRegistration` — requires a non-empty reason, sets `rejected` + `rejected_reason`, `notifyUser('registration.rejected', { reason })`.

> `getPendingRegistrations` only returns pending profiles **that have an IEEE membership ID** — a profile mid-signup (no IEEE ID yet) isn't shown in the queue.

## Pre-approval — `/pre-approved`

| File | Role |
|------|------|
| `src/app/(portal)/pre-approved/page.tsx` | Gated on `approve_registrations`. Fetches `getPreApprovedMembers()`. |
| `src/app/(portal)/pre-approved/actions.ts` | `addPreApprovedMember(ieeeId, name, email?)`, `removePreApprovedMember(id)`. |
| `src/app/(portal)/pre-approved/client.tsx` | Add dialog + table with Claimed/Waiting badge, delete (native `confirm()`). |

Adding an IEEE ID to `pre_approved_members` means the next signup with that ID **auto-approves** (skips the pending queue). `getPreApprovedMembers` also computes a `is_claimed` flag by checking whether any profile already carries that IEEE ID.

> `addPreApprovedMember` maps the Postgres unique-violation `23505` to a friendly "already pre-approved" message.

## Who can approve

Any position/grant carrying `approve_registrations` — by default **MDO** and **Chair**/**Vice Chair** (see [../PERMISSIONS.md](../PERMISSIONS.md)). `canApproveRegistrations` also lets the check succeed for a holder in **any** branch (the queue isn't branch-scoped). Super-admins bypass via the `*` wildcard.

## Key decisions & rationale

- **Idempotent approvals** via the `.eq('status','pending')` guard — safe against double-submits and races.
- **Pre-approval whitelist** exists because most legitimate members are known in advance (the MDO has the IEEE roster); it removes manual review for them while still gating unknown signups.
- **Notifications on decision** close the loop with the applicant (email + in-app).

## How to extend

- To notify branch admins when a new registration lands, add a `notifyBranch` call in `signUp`/`completeRegistration` (a catalog entry would be needed — see [notifications.md](notifications.md)).
- To branch-scope the approval queue, filter `getPendingRegistrations` by the reviewer's branch (currently all-branch).
