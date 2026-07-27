# Feature: Workspace Switching (Role Switcher)

> Lets a member who holds several memberships choose which one is "active" — which changes their branch, position, and **permission set**.
> Not to be confused with [impersonation](impersonation.md) (a super-admin viewing *someone else*).

---

## What it does

A user can belong to multiple branches / hold multiple positions (each is a `memberships` row). Exactly one is the **active workspace** at a time. The active workspace determines:
- which branch's data the portal shows,
- which position/branch appears in the sidebar and user card,
- **which permissions are resolved** (permissions are workspace-scoped, never merged — see [../PERMISSIONS.md](../PERMISSIONS.md)).

The active workspace is stored in the `atrium_workspace_id` cookie (1-year expiry).

## File map

| File | Role |
|------|------|
| `src/utils/auth/workspace.ts` | `setActiveWorkspace` / `getActiveWorkspace` / `clearActiveWorkspace` — the cookie. |
| `src/app/(portal)/actions.ts` | `switchWorkspace(membershipId)` server action. |
| `src/components/portal/sidebar.tsx` | The `RoleSwitcher` dropdown (only rendered when the user has >1 membership). |
| `src/app/(portal)/profile/client.tsx` | Per-position "Switch to Workspace" form on the About Me page. |
| `src/app/(portal)/layout.tsx` | Resolves the active workspace and passes it into permission resolution. |

## Data flow

```
RoleSwitcher / profile card
   └─ switchWorkspace(membershipId)                       [server action]
        ├─ validate: membership belongs to session.user.id AND ended_at IS NULL
        ├─ setActiveWorkspace(membershipId)               → cookie atrium_workspace_id
        ├─ membership_audit_log INSERT (action: 'workspace_switched')
        └─ revalidatePath('/', 'layout')
   └─ router.refresh() + success/error toast              [client]
```

On the next render, `layout.tsx` reads the cookie, calls `getUserProfileWithMembership(profileId, activeWorkspaceId)`, and resolves **workspace-scoped** permissions by passing `profile.membership_id` to `getUserPermissions`.

## UX (this was polished — see git history)

- The switcher shows the active workspace as `position · branch` and a dropdown of the others, each with a **checkmark** on the active one and a **spinner** on the one being switched to.
- On switch it shows a **toast** ("Switched to MDO · IEEE SBNU") on success, or an error toast on failure.
- It renders **only** when `memberships.length > 1` (a single-membership user has nothing to switch).

## Key decisions & rationale

- **Cookie, not session/JWT.** The active workspace changes often and independently of auth; a long-lived cookie avoids re-issuing the JWT and persists across sessions.
- **Append-only memberships** mean "which membership" is a stable id to point at; switching never mutates membership rows.
- **Audited.** Every switch writes a `membership_audit_log` row, so the history of who-acted-as-what is preserved.

## Gotchas

- **`switchWorkspace` validates against `session.user.id`.** During [impersonation](impersonation.md), `session.user.id` is the *real super-admin*, not the impersonated user — so a super-admin **cannot** use the in-portal Role Switcher to hop between the impersonated user's workspaces. To view a different membership of that user, exit and **Open Workspace** on the other membership from the super-admin console. (Documented limitation; noted as a possible follow-up.)
- The layout uses the **impersonation** membership as the active workspace while impersonating, ignoring the cookie (`layout.tsx`).
- `signOut()` does **not** clear `atrium_workspace_id` (only `exitWorkspace` clears impersonation). `clearActiveWorkspace` exists but is invoked selectively.

## How to extend

- To surface the switcher elsewhere, call `switchWorkspace(membershipId)` and `router.refresh()`.
- To change scoping rules, edit `getUserPermissions` in `src/utils/auth/permissions.ts` (see [../PERMISSIONS.md](../PERMISSIONS.md) §4).
