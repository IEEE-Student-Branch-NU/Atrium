-- ============================================================
-- IEEE SBNU Event Creation Portal — Initial Schema
-- Migration: 00001_initial_schema.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE portal_role AS ENUM ('member', 'admin', 'super_admin');

CREATE TYPE event_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'published');

CREATE TYPE approval_decision AS ENUM ('approved', 'rejected');


-- ────────────────────────────────────────────────────────────
-- 1. PROFILES (synced from auth.users)
-- ────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Public-facing user identity, auto-synced from auth.users on signup.';

-- Trigger: auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-update updated_at on profile changes
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();


-- ────────────────────────────────────────────────────────────
-- 2. BRANCHES
-- ────────────────────────────────────────────────────────────

CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  parent_id   UUID REFERENCES branches(id),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE branches IS 'IEEE organizational hierarchy. SBNU is root (parent_id = NULL), sub-branches point to it.';

-- Seed the branch hierarchy
DO $$
DECLARE
  sbnu_id UUID;
BEGIN
  -- Insert root branch
  INSERT INTO branches (name, slug, parent_id)
  VALUES ('IEEE SBNU', 'sbnu', NULL)
  RETURNING id INTO sbnu_id;

  -- Insert sub-branches
  INSERT INTO branches (name, slug, parent_id) VALUES
    ('IEEE SIGHT', 'sight', sbnu_id),
    ('IEEE WIE',   'wie',   sbnu_id),
    ('IEEE CS',    'cs',    sbnu_id),
    ('IEEE ITSS',  'itss',  sbnu_id),
    ('IEEE SPS',   'sps',   sbnu_id);
END $$;


-- ────────────────────────────────────────────────────────────
-- 3. POSITIONS (branch-scoped org titles)
-- ────────────────────────────────────────────────────────────

CREATE TABLE positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (branch_id, name)
);

COMMENT ON TABLE positions IS 'Organizational positions scoped per branch (Chair, Vice Chair, Technical Head, etc.).';

-- Seed common positions for all branches
INSERT INTO positions (branch_id, name)
SELECT b.id, p.name
FROM branches b
CROSS JOIN (
  VALUES
    ('Chair'),
    ('Vice Chair'),
    ('General Secretary'),
    ('Technical Head'),
    ('Creative Head')
) AS p(name);


-- ────────────────────────────────────────────────────────────
-- 4. MEMBERSHIPS (append-only history)
-- ────────────────────────────────────────────────────────────

CREATE TABLE memberships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  portal_role         portal_role NOT NULL DEFAULT 'member',
  position_id         UUID REFERENCES positions(id),
  can_create_events   BOOLEAN NOT NULL DEFAULT false,
  joined_date         DATE,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  assigned_by         UUID REFERENCES profiles(id),
  reason              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (profile_id, branch_id, portal_role, position_id, assigned_at)
);

COMMENT ON TABLE memberships IS 'Append-only membership history. Active record = ended_at IS NULL. Never overwrite, only insert new records.';

-- Fast lookup: current active memberships for a user in a branch
CREATE INDEX idx_memberships_active
  ON memberships (profile_id, branch_id)
  WHERE ended_at IS NULL;

-- Fast lookup: all active members in a branch
CREATE INDEX idx_memberships_branch_active
  ON memberships (branch_id)
  WHERE ended_at IS NULL;


-- ────────────────────────────────────────────────────────────
-- 5. EVENT TYPES (admin-managed lookup)
-- ────────────────────────────────────────────────────────────

CREATE TABLE event_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE event_types IS 'Admin-managed event categories. Add/modify via UI without migrations.';

-- Seed initial event types (to be finalized with chair)
INSERT INTO event_types (name) VALUES
  ('Workshop'),
  ('Hackathon'),
  ('Guest Lecture'),
  ('Social'),
  ('Competition'),
  ('Seminar');


-- ────────────────────────────────────────────────────────────
-- 6. EVENTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  creator_id       UUID NOT NULL REFERENCES profiles(id),
  event_type_id    UUID REFERENCES event_types(id),

  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  event_date       TIMESTAMPTZ NOT NULL,
  organizer_email  TEXT NOT NULL,
  banner           JSONB,

  capacity         INT,
  location         TEXT,

  status           event_status NOT NULL DEFAULT 'draft',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at     TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE events IS 'Core event entity. Hard-deleted; audit log preserves history.';
COMMENT ON COLUMN events.banner IS 'ImageKit metadata: { url, file_id, width, height, format }';

-- Dashboard: events by branch and status
CREATE INDEX idx_events_branch_status ON events (branch_id, status);

-- Creator's event list
CREATE INDEX idx_events_creator ON events (creator_id);

-- Auto-update updated_at
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();


-- ────────────────────────────────────────────────────────────
-- 7. EVENT APPROVALS (multi-level)
-- ────────────────────────────────────────────────────────────

CREATE TABLE event_approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  level       INT NOT NULL DEFAULT 1,
  approver_id UUID NOT NULL REFERENCES profiles(id),
  decision    approval_decision NOT NULL,
  comment     TEXT,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (event_id, level)
);

COMMENT ON TABLE event_approvals IS 'One row per approval level per event. Level 1 = branch admin, Level 2 = SBNU admin.';

CREATE INDEX idx_event_approvals_event ON event_approvals (event_id);


-- ────────────────────────────────────────────────────────────
-- 8. EVENT AUDIT LOG
-- ────────────────────────────────────────────────────────────

CREATE TABLE event_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID,                              -- intentionally NOT a FK (survives hard delete)
  action      TEXT NOT NULL,
  changed_by  UUID NOT NULL REFERENCES profiles(id),
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE event_audit_log IS 'Immutable log of all event lifecycle actions. event_id is NOT a FK — must survive hard deletes.';
COMMENT ON COLUMN event_audit_log.action IS 'One of: created, submitted, approved, rejected, published, deleted, edited';
COMMENT ON COLUMN event_audit_log.details IS 'Snapshot of changes (from/to values). On delete: full event data snapshot.';

CREATE INDEX idx_event_audit_event ON event_audit_log (event_id);
CREATE INDEX idx_event_audit_action ON event_audit_log (action);


-- ────────────────────────────────────────────────────────────
-- 9. MEMBERSHIP AUDIT LOG
-- ────────────────────────────────────────────────────────────

CREATE TABLE membership_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles(id),
  branch_id       UUID NOT NULL REFERENCES branches(id),
  action          TEXT NOT NULL,
  changed_by      UUID NOT NULL REFERENCES profiles(id),
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE membership_audit_log IS 'Immutable log of all membership, role, and position changes.';
COMMENT ON COLUMN membership_audit_log.action IS 'One of: role_assigned, role_revoked, position_changed, event_creation_granted, event_creation_revoked';
COMMENT ON COLUMN membership_audit_log.details IS 'Change details: { old_role, new_role, old_position, new_position, reason }';

CREATE INDEX idx_membership_audit_profile ON membership_audit_log (profile_id);
CREATE INDEX idx_membership_audit_branch ON membership_audit_log (branch_id);
