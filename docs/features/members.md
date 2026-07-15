# Feature: Members Directory & Profile

> `/members` (everyone directory), `/members/[id]` (read-only member view), and `/profile` (About Me — the only place a user edits their own data and requests positions).

---

## Members directory — `/members`

| File | Role |
|------|------|
| `src/app/(portal)/members/page.tsx` | **No permission guard** — any authenticated user. Fetches `getMembersDirectory()` + `getAllBranches()`; filters out the logged-in user. |
| `src/app/(portal)/members/client.tsx` | Search (name/email/IEEE/position/branch) + branch filter; **realtime** on `profiles`/`memberships` → `router.refresh()`; cards link to `/members/[id]`. |

`getMembersDirectory` returns approved profiles each with **one** active membership (preferring a membership that has a position), assembled from a single batched query.

> The `/members` realtime subscription uses an **anonymous** Supabase client (no token), so it only reacts to changes visible to the anon role. This is separate from the notification realtime (which uses a minted JWT).

## Member detail — `/members/[id]`

- `params` is a `Promise` (Next 16) — awaited. Viewing yourself redirects to `/profile`. `notFound()` if the profile is missing or not `approved`.
- **Read-only:** header, bio, skills, active vs past positions. No mutations.

## About Me — `/profile`

| File | Role |
|------|------|
| `src/app/(portal)/profile/page.tsx` | Actor-based; fetches full profile, the user's own position requests, branches, and the active workspace id. |
| `src/app/(portal)/profile/actions.ts` | `updateProfile`, `changePassword`, `requestPosition`. |
| `src/app/(portal)/profile/client.tsx` | Edit-profile, change-password, request-position dialogs; positions list with per-card "Switch to Workspace". |
| `src/app/api/positions/route.ts` | Auth-gated GET used by the request-position dialog to load positions for a chosen branch. |

**Actions:**
- `updateProfile` — validates name (≥2) and phone (`+91 XXXXX XXXXX`), parses comma-separated skills, updates `profiles`.
- `changePassword` — min 8 + match; if a `password_hash` exists, verifies the current password with bcrypt; supports **first-time set** for OAuth users with no hash; writes a `password_changed` audit row.
- `requestPosition` — see [position-requests.md](position-requests.md).

The positions section lets a multi-membership user **Switch to Workspace** directly (see [workspace-switching.md](workspace-switching.md)).

## Gotchas

- `/members` is intentionally ungated (a member directory is visible to all members) — don't assume every portal page is permission-gated.
- `profile/page.tsx` has an unused hardcoded `hasPasswordAuth = true`; the real signal is `profile.has_password` (derived from `password_hash`, which is then stripped before returning).
- The request-position dialog fetches positions via `/api/positions?branchId=` in a `useEffect` on branch change (a branch→position cascade).

## How to extend

- To let members edit more fields, extend `updateProfile` + the edit dialog.
- To show more on the public member card, extend `getFullUserProfile` and `/members/[id]/client.tsx` (keep it read-only).
