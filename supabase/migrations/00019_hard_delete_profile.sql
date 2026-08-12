-- ============================================================
-- Migration 00019: Make superadmin hard delete actually work
-- ============================================================
-- Hard delete was calling supabase.auth.admin.deleteUser(), but migration
-- 00003_nextauth_migration.sql decoupled `profiles` from Supabase Auth (auth is
-- NextAuth + bcrypt in profiles.password_hash now). There is no auth.users row,
-- so that call 404'd and nothing was ever deleted.
--
-- Deleting the profiles row directly was blocked by 10 foreign keys pointing at
-- profiles(id) with no ON DELETE action. This migration resolves each one so the
-- *person* can be permanently erased while the *record of their work* survives:
--
--   * rows the person OWNS (memberships, permissions, notifications, requests)
--     already CASCADE and are left alone — they should vanish with them.
--   * ATTRIBUTION columns become nullable + SET NULL, after freezing an identity
--     snapshot onto events/event_approvals so authored work stays readable.
--   * the two AUDIT LOGS drop the FK and keep the raw UUID. This is the repo's
--     established pattern (event_audit_log.event_id is "intentionally NOT a FK
--     (survives hard delete)", 00001_initial_schema.sql:257) and the reason
--     docs/SCHEMA.md rejects soft deletes: the log preserves the history.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Attribution snapshots
--    event_audit_log is legacy and has no write sites in src/, so it cannot be
--    relied on to preserve authorship. Snapshot onto the rows themselves.
-- ────────────────────────────────────────────────────────────

ALTER TABLE events          ADD COLUMN IF NOT EXISTS creator_snapshot  JSONB;
ALTER TABLE event_approvals ADD COLUMN IF NOT EXISTS approver_snapshot JSONB;

COMMENT ON COLUMN events.creator_snapshot IS
  'Written only by hard_delete_profile(): { id, full_name, email } of the deleted creator. NULL while creator_id is live.';
COMMENT ON COLUMN event_approvals.approver_snapshot IS
  'Written only by hard_delete_profile(): { id, full_name, email } of the deleted approver. NULL while approver_id is live.';


-- ────────────────────────────────────────────────────────────
-- 2. Rewrite the blocking foreign keys
--    Constraint names follow Postgres defaults, but we look them up in
--    pg_constraint rather than trusting the name — safe against a differently
--    named constraint and re-runnable.
-- ────────────────────────────────────────────────────────────

-- `set_null = true`  → attribution column: nullable + ON DELETE SET NULL.
-- `set_null = false` → audit log: FK dropped, raw UUID kept, stays NOT NULL.
--                      The actor is always recorded, they just may no longer
--                      resolve to a live profiles row. Resolve deleted actors
--                      via the `hard_delete_user` audit_log entry, which carries
--                      their identity snapshot.
DO $$
DECLARE
  r       RECORD;
  v_name  TEXT;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('events',               'creator_id',       true),   -- was NOT NULL
    ('event_approvals',      'approver_id',      true),   -- was NOT NULL
    ('member_permissions',   'granted_by',       true),   -- was NOT NULL
    ('memberships',          'assigned_by',      true),
    ('profiles',             'approved_by',      true),   -- self-referencing
    ('pre_approved_members', 'added_by',         true),
    ('position_requests',    'decided_by',       true),
    ('notifications',        'actor_profile_id', true),
    ('audit_log',            'actor_profile_id', false),
    ('event_audit_log',      'changed_by',       false)
  ) AS t(tbl, col, set_null)
  LOOP
    -- Look the constraint up rather than trusting the default name, so this is
    -- safe against a differently named constraint and re-runnable.
    FOR v_name IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.conrelid = format('public.%I', r.tbl)::regclass
        AND c.confrelid = 'public.profiles'::regclass
        AND array_length(c.conkey, 1) = 1
        AND a.attname = r.col
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, v_name);
    END LOOP;

    IF r.set_null THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', r.tbl, r.col);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
        r.tbl, r.tbl || '_' || r.col || '_fkey', r.col
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN audit_log.actor_profile_id IS
  'Intentionally NOT a FK — must survive a hard delete of the actor. May reference a deleted profile.';
COMMENT ON COLUMN event_audit_log.changed_by IS
  'Intentionally NOT a FK — must survive a hard delete of the actor. May reference a deleted profile.';

-- idx_audit_log_actor is kept: still serves lookups by raw UUID.


-- ────────────────────────────────────────────────────────────
-- 3. Atomic hard delete
--    The Supabase JS client cannot span statements in a transaction, so the
--    snapshot-then-delete lives in one function. Returns the deleted profile
--    (minus the password hash) so the caller can write a meaningful audit entry
--    after the row is gone.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.hard_delete_profile(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot JSONB;
  v_identity JSONB;
BEGIN
  SELECT to_jsonb(p) INTO v_snapshot FROM profiles p WHERE p.id = p_profile_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Profile % not found', p_profile_id;
  END IF;

  IF COALESCE((v_snapshot->>'is_super_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Refusing to hard delete a super admin';
  END IF;

  v_identity := jsonb_build_object(
    'id',        p_profile_id,
    'full_name', v_snapshot->>'full_name',
    'email',     v_snapshot->>'email'
  );

  -- Freeze attribution BEFORE the FKs null the columns out.
  UPDATE events
     SET creator_snapshot = v_identity
   WHERE creator_id = p_profile_id;

  UPDATE event_approvals
     SET approver_snapshot = v_identity
   WHERE approver_id = p_profile_id;

  -- Their pre-approval goes with them, so the IEEE ID cannot silently
  -- auto-approve a re-registration. Done here, inside the same transaction as
  -- the delete — the old app-layer version ran this first and stripped the
  -- pre-approval even when the delete then failed.
  IF v_snapshot->>'ieee_membership_id' IS NOT NULL THEN
    DELETE FROM pre_approved_members
     WHERE ieee_membership_id = v_snapshot->>'ieee_membership_id';
  END IF;

  -- Cascades the person's own rows; SET NULLs every attribution reference.
  DELETE FROM profiles WHERE id = p_profile_id;

  RETURN v_snapshot - 'password_hash';
END $$;

COMMENT ON FUNCTION public.hard_delete_profile(UUID) IS
  'Permanently erases a profile and everything personal to them. Events and approvals they authored are kept, reattributed via creator_snapshot/approver_snapshot. Audit-log rows survive with a dangling actor UUID. Refuses super admins.';

-- Service role only — this is called from a server action already behind
-- requireSuperAdmin() + a superadmin passphrase check.
REVOKE ALL ON FUNCTION public.hard_delete_profile(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hard_delete_profile(UUID) FROM anon, authenticated;
