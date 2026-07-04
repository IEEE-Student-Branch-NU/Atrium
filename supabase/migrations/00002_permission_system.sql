-- ============================================================
-- IEEE SBNU Event Portal — Permission System + Registration Gating
-- Migration: 00002_permission_system.sql
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. NEW ENUM: registration_status
-- ────────────────────────────────────────────────────────────

CREATE TYPE registration_status AS ENUM ('pending', 'approved', 'rejected');


-- ────────────────────────────────────────────────────────────
-- 2. ALTER profiles — add registration + identity fields
-- ────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN ieee_membership_id TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN phone TEXT;
ALTER TABLE profiles ADD COLUMN section TEXT DEFAULT 'Gujarat Section';
ALTER TABLE profiles ADD COLUMN membership_expiry DATE;
ALTER TABLE profiles ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN status registration_status NOT NULL DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN approved_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN rejected_reason TEXT;


-- ────────────────────────────────────────────────────────────
-- 3. DROP portal_role from memberships (replaced by permissions)
-- ────────────────────────────────────────────────────────────

ALTER TABLE memberships DROP COLUMN IF EXISTS portal_role;
ALTER TABLE memberships DROP COLUMN IF EXISTS can_create_events;

-- Drop the old unique constraint that included portal_role
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_profile_id_branch_id_portal_role_position_id_a_key;

-- Add updated unique constraint without portal_role
ALTER TABLE memberships ADD CONSTRAINT memberships_unique_active
  UNIQUE (profile_id, branch_id, position_id, assigned_at);

-- Drop the enum type
DROP TYPE IF EXISTS portal_role;


-- ────────────────────────────────────────────────────────────
-- 4. PERMISSIONS table
-- ────────────────────────────────────────────────────────────

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE permissions IS 'System-wide permission definitions. Referenced by position_permissions and member_permissions.';

-- Seed all permissions
INSERT INTO permissions (name, description) VALUES
  ('create_events',         'Create event drafts in a branch'),
  ('approve_events',        'Approve or reject pending events'),
  ('manage_events',         'Edit or delete any event in the branch'),
  ('manage_members',        'Assign positions and grant permissions to members'),
  ('approve_registrations', 'Approve or reject new member signups'),
  ('view_members',          'View member list and role history'),
  ('view_audit_log',        'Access the audit trail'),
  ('manage_event_types',    'Add or edit event categories'),
  ('manage_positions',      'Create custom positions for the branch');


-- ────────────────────────────────────────────────────────────
-- 5. POSITION_PERMISSIONS — maps positions → permissions
-- ────────────────────────────────────────────────────────────

CREATE TABLE position_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id   UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  UNIQUE (position_id, permission_id)
);

COMMENT ON TABLE position_permissions IS 'Maps organizational positions to their granted permissions.';

-- Seed position → permission mappings for all branches
-- Chair: full branch control
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name = 'Chair';

-- Vice Chair: most permissions except manage_positions
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name = 'Vice Chair'
  AND perm.name IN (
    'create_events', 'approve_events', 'manage_events',
    'manage_members', 'approve_registrations',
    'view_members', 'view_audit_log'
  );

-- General Secretary: event + member visibility
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name = 'General Secretary'
  AND perm.name IN (
    'create_events', 'view_members', 'view_audit_log'
  );

-- Technical Head: event creation
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name = 'Technical Head'
  AND perm.name IN (
    'create_events', 'view_members'
  );

-- Creative Head: event creation
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name = 'Creative Head'
  AND perm.name IN (
    'create_events', 'view_members'
  );


-- ────────────────────────────────────────────────────────────
-- 6. MEMBER_PERMISSIONS — direct ad-hoc permission grants
-- ────────────────────────────────────────────────────────────

CREATE TABLE member_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by    UUID NOT NULL REFERENCES profiles(id),
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,

  UNIQUE (profile_id, branch_id, permission_id, granted_at)
);

COMMENT ON TABLE member_permissions IS 'Direct permission grants to individual members, independent of their position.';

CREATE INDEX idx_member_permissions_active
  ON member_permissions (profile_id, branch_id)
  WHERE revoked_at IS NULL;


-- ────────────────────────────────────────────────────────────
-- 7. PRE_APPROVED_MEMBERS — MDO/SuperAdmin pre-loads IEEE IDs
-- ────────────────────────────────────────────────────────────

CREATE TABLE pre_approved_members (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ieee_membership_id   TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  email                TEXT,
  added_by             UUID REFERENCES profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pre_approved_members IS 'IEEE membership IDs pre-loaded by MDO/SuperAdmin. Signup with a matching ID auto-approves the registration.';


-- ────────────────────────────────────────────────────────────
-- 8. SEED MDO position for all branches
-- ────────────────────────────────────────────────────────────

INSERT INTO positions (branch_id, name)
SELECT id, 'MDO' FROM branches
ON CONFLICT (branch_id, name) DO NOTHING;

-- MDO gets approve_registrations + view_members
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name = 'MDO'
  AND perm.name IN ('approve_registrations', 'view_members');


-- ────────────────────────────────────────────────────────────
-- 9. UPDATE profile trigger to include new fields
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
