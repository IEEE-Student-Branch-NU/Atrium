-- 00013_broadcast_filters.sql

-- 1. Add target_filters to notifications
ALTER TABLE public.notifications 
ADD COLUMN target_filters JSONB;

-- 2. Update the View for Superadmin Notification History to include target_filters
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
  MAX(profile_id::text)::uuid AS single_profile_id,
  BOOL_OR(is_edited) AS is_edited,
  MAX(target_filters::text)::jsonb AS target_filters
FROM public.notifications
GROUP BY COALESCE(broadcast_id, id), broadcast_id;
