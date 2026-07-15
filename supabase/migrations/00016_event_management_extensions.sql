-- ============================================================
-- IEEE SBNU Event Creation Portal — Event Management Extensions
-- Migration: 00010_event_management_extensions.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ALTER ENUM
-- ────────────────────────────────────────────────────────────

-- Add 'completed' status to event_status
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'completed';

-- ────────────────────────────────────────────────────────────
-- 2. EVENT ORGANIZERS
-- ────────────────────────────────────────────────────────────

CREATE TABLE event_organizers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (event_id, profile_id)
);

COMMENT ON TABLE event_organizers IS 'Allows Superadmins/Admins to assign multiple organizers to an event.';

CREATE INDEX idx_event_organizers_event ON event_organizers(event_id);
CREATE INDEX idx_event_organizers_profile ON event_organizers(profile_id);

-- ────────────────────────────────────────────────────────────
-- 3. POST-EVENT GALLERY IMAGES
-- ────────────────────────────────────────────────────────────

CREATE TABLE event_gallery_images (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  imagekit_url     TEXT NOT NULL,
  imagekit_file_id TEXT NOT NULL,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE event_gallery_images IS 'Store bulk post-event images for the gallery via ImageKit.';

CREATE INDEX idx_event_gallery_images_event ON event_gallery_images(event_id);
