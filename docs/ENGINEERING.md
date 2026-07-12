# Atrium — Engineering Conventions, Patterns & Gotchas

> The "how we build here" doc — the patterns to copy, the reasoning behind them, and the traps. Read this before adding a feature. Pairs with [ARCHITECTURE.md](ARCHITECTURE.md).
> **Last Updated:** July 2026

---

## 1. Data access

- **Always `createAdminClient()` server-side.** Service-role key, bypasses RLS. **Never** import it or the service-role key into client code. It lives in Server Components, Server Actions, API routes, and middleware.
- **The browser client** (`utils/supabase/client.ts`) is only for Realtime — with a minted JWT for notifications, or anonymous for the members page.
- **No ORM.** Queries use the supabase-js builder inline, centralized in `lib/queries.ts` (portal) and `app/superadmin/queries.ts` (console).
- **Embedded joins need FK hints when ambiguous.** A table with two FKs to the same parent must name the constraint: `profiles!notifications_profile_id_fkey` vs `profiles!notifications_actor_profile_id_fkey`. Alias to rename: `recipient:profiles!...`, `parent:branches!parent_id(name)`.

## 2. Server Actions

- Mark files `'use server'`. **Re-check auth + permission inside the action** — the UI/nav gate is cosmetic; the action is the real security boundary. Every existing action does this; follow suit.
- **Three result conventions coexist** (know which you're in):
  1. **`{ success } | { error }`** — most actions (all of `superadmin/actions.ts`).
  2. **`throw` on failure** — the portal position-request actions. Callers wrap in try/catch and convert to a toast.
  3. **`redirect()`** — `openWorkspace`/`exitWorkspace`, `signIn*`. On success they navigate, so the `{ error }` return only appears on the failure path.
- **`<form action>` needs `void`.** An action returning `{ error }` can't be a form action directly. Wrap it in an **inline `'use server'` adapter**:
  ```ts
  async function openWorkspaceAction(membershipId: string): Promise<void> {
    'use server'
    await openWorkspace(membershipId)
  }
  ```
- **Run side effects inline in the transition, not in `useEffect`.** Client dialogs do toast/close/`router.refresh()` inside the `startTransition`/`useActionState` flow so a successful mutation reacts immediately without an extra render round-trip.
- Always `revalidatePath(...)` the affected routes (often `('/', 'layout')`).

## 3. Best-effort side effects (never break the main action)

Notifications, email, and audit writes are **best-effort** — wrapped in try/catch, failures logged, never thrown into the caller.
- `logAdminAction` (`utils/auth/audit.ts`): *"a failed audit must not break the action."*
- `notify*` (`lib/notifications/notify.ts`): *"a notification (or its email) failing must NEVER throw into the calling server action — mirrors logAdminAction."*
- `email.ts`: no-op (no throw) when `RESEND_API_KEY`/`EMAIL_FROM` are unset.

Copy this for any new non-critical side effect.

## 4. Append-only history

- `memberships` and `member_permissions` are **never updated in place**. Active = `ended_at IS NULL` / `revoked_at IS NULL`. To "remove", set the timestamp; to "change", insert a new row.
- Partial indexes exist for the `IS NULL` predicate. Every active read applies `.is('ended_at', null)`.
- The audit-log tables (`membership_audit_log`, `event_audit_log`, `audit_log`) record the mutations. `event_audit_log.event_id` is intentionally **not a FK** so entries survive hard deletes.

## 5. Migrations are manual

- SQL files live in `supabase/migrations/`. **They are applied by hand in the Supabase SQL editor** — there is no automated migration runner in this project.
- **Write code that degrades** when a migration isn't applied yet: reads that select new columns wrap in try/catch and return empty (`getAllNotifications`, `getAuditLog`); best-effort inserts silently no-op. This is why the notifications/audit pages show empty (not error) before their migration is applied.
- When you add a migration, follow the existing numbering (`000NN_name.sql`), add it to [SCHEMA.md](SCHEMA.md) §10 and the README setup list, and note if it must be applied for a feature to work.

## 6. Auth / Edge-safety boundary

- **Never** import `bcrypt` or a `server-only` module into anything the Edge middleware pulls in (`middleware.ts`, `auth.config.ts`). Read super-admin status from the **JWT flag** at the Edge; do bcrypt/crypto server-side only.
- The impersonation cookie is only **presence-checked** at the Edge; it's cryptographically verified server-side in `getEffectiveActor`.
- `isSuperAdmin` is stamped onto the JWT **once at sign-in** (it needs bcrypt). Don't try to recompute it per-request in Edge code.

## 7. Permissions

- Resolve **workspace-scoped** by passing `membership_id` to `getUserPermissions`. Omitting it hits a legacy fallback that unions permissions across all active memberships in the branch — which is why some older pages disagree with the sidebar. Prefer scoped. See [PERMISSIONS.md](PERMISSIONS.md).
- `hasPermission` honors the `*` wildcard (super-admin).

## 8. Search input

- Any user search term interpolated into a PostgREST `.or(...ilike...)` string **must** go through `sanitizeSearchTerm` (`utils/search.ts`) first — it strips `.or()` structural chars and escapes ILIKE wildcards. This is a structural sanitizer (the values are still PostgREST-parameterized), needed because the `.or()` string is hand-assembled.

## 9. UI kit notes

- Primitives live in `src/components/ui/` (shadcn / **Base-UI** style). Triggers use `render={<Component/>}`, **not** shadcn's `asChild`.
- **Disabled pagination** renders a plain disabled `Button`, never a disabled `Link` — a disabled anchor still navigates.
- Destructive confirmations use the **native `confirm()`** (e.g. delete position/pre-approved) — there's no blocking-confirm dialog component.
- **Missing primitives:** no `form`, `popover`, `command`, or `calendar` — relevant if you build the [Events](features/events.md) UI (you'll need a date picker).

## 10. Known non-atomic / sharp edges

- `setPositionPermissions` is delete-then-insert across two REST calls — **non-atomic**; a failed insert leaves the position with zero permissions (admin retry fixes). True atomicity needs a Postgres RPC.
- `deletePosition` must count **all** (active + ended) memberships because `memberships.position_id` is FK `RESTRICT`.
- Analytics loads all profiles into memory and buckets by a locale date string (fine at current scale).

## 11. Testing

- Vitest, `environment: 'node'`, tests at `src/**/__tests__/**/*.test.ts`. `test` = `vitest run`.
- Tests target **pure functions** — `resolveEffectiveActor`, `matchesSuperAdmin`, `sanitizeSearchTerm`, the notification catalog/payload/visibility helpers. Keep new logic pure where possible so it's testable.
- **`server-only` is aliased to `src/test/empty.ts`** in `vitest.config.ts` so `server-only` modules load in plain Node tests.
- **Verification gate for this repo = build + test, not lint.** Run `npm run build` and `npm test`. (Migrations are manual, so full runtime verification also needs the migration applied in Supabase.)

## 12. Stale things to watch (as of this writing)

- `graphify-out/` referenced by `AGENTS.md`/`CLAUDE.md` **does not exist** in the checkout — `graphify query` won't work here; ignore that guidance until the graph is generated.
- A comment in `auth.ts` claims the fixed super-admin has no `profiles` row — it actually does (migration `00010`); the explicit `profileId` stamp is defensive.
- The portal **Events** nav links and `/audit` link are **dead** (no such pages). See [features/events.md](features/events.md).
- The portal top bar always shows the title "Dashboard".

## Adding a feature — the copy-paste recipe

1. **Page:** copy `approvals/page.tsx` — `auth()` → `getUserProfileWithMembership` → `getUserPermissions(..., profile.membership_id)` → `hasPermission` guard/redirect → fetch via a `queries.ts` function → render a client component.
2. **Nav:** add a `NAV_SECTIONS` entry in `sidebar.tsx` with the matching `permission`.
3. **Mutation:** add `actions.ts` (`'use server'`) — re-check permission, mutate via admin client, fire `notify*`, write audit rows, `revalidatePath`.
4. **Notification (optional):** add a `NOTIFICATION_EVENTS` entry, call `notify*`.
5. **Verify:** `npm run build && npm test`; apply any migration in Supabase; smoke-test the flow.
