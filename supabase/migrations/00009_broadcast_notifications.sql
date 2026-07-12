-- ============================================================
-- Migration 00009: Broadcast Notifications
-- Makes profile_id nullable for broadcast notifications,
-- adds CHECK constraint, enables RLS, adds SELECT policy, and
-- adds to supabase_realtime publication.
-- ============================================================

-- 1. Make profile_id nullable (for broadcast messages without a single recipient)
ALTER TABLE public.notifications
  ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Add CHECK constraint enforcing broadcast logic
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_recipient_check
  CHECK (
    (type = 'broadcast' AND profile_id IS NULL) OR
    (type != 'broadcast' AND profile_id IS NOT NULL)
  );

-- 3. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Add SELECT policy
CREATE POLICY "Users can read own or broadcast notifications"
  ON public.notifications
  FOR SELECT
  USING (
    auth.uid()::text = profile_id::text OR type = 'broadcast'
  );

-- 5. Add the notifications table to the supabase_realtime publication
-- The publication 'supabase_realtime' is created by default in Supabase projects.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- Enable Realtime for profiles and memberships
-- This allows the Next.js client to listen for changes via websockets

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE memberships;
