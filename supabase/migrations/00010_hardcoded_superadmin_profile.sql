-- ============================================================
-- Migration 00010: backing profile for the fixed super-admin login
-- ============================================================
-- The super-admin portal supports a fixed username/password login handled
-- entirely in code (see src/auth.ts — SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD,
-- read from env). That identity is never created via signup, so this seeds a
-- matching `profiles` row.
--
-- The id MUST equal SUPERADMIN_ID in src/auth.ts so that writes which
-- FK-reference the acting admin resolve successfully, i.e.:
--   audit_log.actor_profile_id, memberships.assigned_by,
--   membership_audit_log.changed_by, member_permissions.granted_by.
--
-- Login itself NEVER reads this row (no username/password stored here) — it
-- exists purely for referential integrity. `status = 'approved'` keeps it out
-- of any pending/rejected gating if it is ever surfaced.
-- ============================================================

INSERT INTO public.profiles (id, email, full_name, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'superadmin@atrium.local',
  'Super Admin',
  'approved'
)
ON CONFLICT (id) DO NOTHING;
