-- ============================================================
-- Migration 00006: Workspace & Position Requests
-- Adds bio/skills to profiles, position_requests table,
-- notifications table, and a request_status enum.
-- ============================================================

-- 1. Add bio and skills to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS skills TEXT[];

-- 2. Enum for position request statuses
DO $$ BEGIN
  CREATE TYPE position_request_status AS ENUM (
    'pending',
    'under_review',
    'approved',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Position Requests table
CREATE TABLE IF NOT EXISTS position_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  position_id   UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  status        position_request_status NOT NULL DEFAULT 'pending',
  reason        TEXT NOT NULL,
  description   TEXT,
  supporting_notes TEXT,
  admin_comment TEXT,
  decided_by    UUID REFERENCES profiles(id),
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER position_requests_updated_at
  BEFORE UPDATE ON position_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_position_requests_profile
  ON position_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_position_requests_status
  ON position_requests(status);

-- 4. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  link          TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
  ON notifications(profile_id)
  WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_profile_created
  ON notifications(profile_id, created_at DESC);
