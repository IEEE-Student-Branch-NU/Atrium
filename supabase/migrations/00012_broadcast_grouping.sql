-- 00012_broadcast_grouping.sql

-- 1. Add broadcast_id to notifications for grouping
ALTER TABLE public.notifications 
ADD COLUMN broadcast_id UUID;

-- 2. Add is_edited flag to track if a notification was modified after sending
ALTER TABLE public.notifications
ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT false;

-- 3. Create the View for Superadmin Notification History
-- This groups notifications by broadcast_id so they appear as a single summary row.
-- Personal notifications (where broadcast_id is NULL) are kept individual.
CREATE OR REPLACE VIEW admin_notification_history AS
SELECT 
  COALESCE(broadcast_id, id) AS id,
  broadcast_id,
  MAX(title) AS title,
  MAX(message) AS message,
  MAX(type) AS type,
  MAX(created_at) AS created_at,
  COUNT(profile_id) AS recipient_count,
  SUM(CASE WHEN is_read THEN 1 ELSE 0 END) AS read_count,
  MAX(profile_id::text)::uuid AS single_profile_id, -- Used to fetch profile details if it's a personal notification
  BOOL_OR(is_edited) AS is_edited
FROM public.notifications
GROUP BY COALESCE(broadcast_id, id), broadcast_id;
