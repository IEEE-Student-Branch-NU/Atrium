# Feature: Workspace Impersonation ("Open Workspace")

> Lets a **super-admin** enter any user's portal and act as them — to debug, verify a role, or manage on their behalf. Distinct from [workspace switching](workspace-switching.md) (a user choosing among *their own* memberships).

---

## What it does

From the super-admin console, "Open Workspace" on a specific **membership** drops the super-admin into the member portal (`/`) rendered **as that user in that membership**. A persistent banner shows whose workspace is open, with an **Exit workspace** button. For a user with multiple roles (e.g. Priyansh: *MDO* and *Technical Associate*), each membership is a separate openable workspace.

## File map

| File | Role |
|------|------|
| `src/utils/auth/impersonation.ts` | The `atrium_impersonate` JWT cookie: `setImpersonation` / `getImpersonatedMembershipId` / `clearImpersonation` (jose HS256, `AUTH_SECRET`, 4h expiry). |
| `src/utils/auth/effective-actor.ts` | Pure `resolveEffectiveActor()` — computes acting-vs-real actor. Unit-tested. |
| `src/utils/auth/superadmin.ts` | `getEffectiveActor()` — the IO wrapper: reads session + cookie, validates the target membership is active, calls `resolveEffectiveActor`. |
| `src/app/superadmin/actions.ts` | `openWorkspace(membershipId)` / `exitWorkspace()`. |
| `src/components/superadmin/open-workspace-menu.tsx` | Per-user menu on the Users list (0 → disabled, 1 → button, 2+ → pick a role). |
| `src/app/superadmin/(dashboard)/users/[profileId]/page.tsx`, `organizations/[branchId]/page.tsx` | Per-membership "Open Workspace" forms. |
| `src/components/superadmin/impersonation-banner.tsx` | The "Viewing X's workspace" banner + Exit. |
| `src/app/(portal)/layout.tsx` | Consumes `getEffectiveActor()`; renders the banner; scopes everything to the acting profile. |

## Data flow

```
Enter:
  Open Workspace → openWorkspace(membershipId)            [super-admin action]
     ├─ load membership (must be active), audit 'workspace_opened'
     ├─ setImpersonation(membershipId)   → signed cookie atrium_impersonate (4h)
     └─ redirect('/')

Every portal render:
  getEffectiveActor()
     ├─ session (real super-admin) + getImpersonatedMembershipId() (verify JWT)
     ├─ validate target membership still active (ended_at IS NULL)
     └─ resolveEffectiveActor() → { isImpersonating, actingProfileId, actingMembershipId,
                                     realProfileId, realEmail, isSuperAdmin }

Exit:
  Exit workspace → exitWorkspace() → clearImpersonation() → redirect('/superadmin')
```

## The acting-vs-real split (important)

`getEffectiveActor()` returns **both** identities:
- **`actingProfileId` / `actingMembershipId`** — used for all **reads/display**: profile, memberships, permissions, notifications, and the minted Supabase realtime token. This is what makes the portal "look like" the impersonated user.
- **`realProfileId` / `realEmail` / `isSuperAdmin`** — always the true super-admin, used for **attribution** of mutations and audit writes.

> Rule of thumb: **render as the acting user, attribute to the real user.**

## Access gating

- Only a super-admin can impersonate: `resolveEffectiveActor` sets `canImpersonate = isSuperAdmin && impersonatedMembership != null`; a non-super-admin with a stray cookie is ignored (unit-tested in `effective-actor.test.ts`).
- The Edge middleware only checks **cookie presence** (`request.cookies.has('atrium_impersonate')`) — it deliberately does **not** verify the JWT (bcrypt/jose crypto is not run in the Edge bundle). Full cryptographic verification happens server-side in `getEffectiveActor`.

## Key decisions & rationale

- **Signed JWT cookie, not a DB session** — stateless, verifiable with `AUTH_SECRET`, and self-expiring (4h) independent of the NextAuth session.
- **Cookie name hardcoded in middleware** to avoid importing the `server-only` impersonation module into the Edge bundle.
- **Membership-scoped, not user-scoped** — you open a *specific role*, which is why multi-role users expose multiple openable workspaces.
- **Reuses the member portal** rather than building a shadow admin UI — the super-admin sees exactly what the user sees.

## Gotchas

- `openWorkspace`/`exitWorkspace` **redirect** on success, so their `{ error }` return only appears on the failure path — callers treat "success = navigation, no return value".
- The impersonation cookie **expires after 4h** regardless of the NextAuth session; after that the portal reverts to the real super-admin identity.
- While impersonating, the in-portal Role Switcher can't switch among the impersonated user's other memberships (see [workspace-switching.md](workspace-switching.md) gotchas) — exit and open the other membership instead.

## How to extend

- To add another entry point, render a form/button that calls `openWorkspace(membershipId)` (or the `OpenWorkspaceMenu` component with the user's active memberships).
- To attribute a new mutation correctly during impersonation, write audit/`assigned_by`/etc. with `realProfileId` (from `getEffectiveActor`), not `actingProfileId`.
