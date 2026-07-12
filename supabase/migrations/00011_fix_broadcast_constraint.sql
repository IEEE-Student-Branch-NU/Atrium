-- 00011_fix_broadcast_constraint.sql

-- Drop the overly restrictive constraint from migration 00009
-- This allows us to send broadcast notifications with visual types like 'info' or 'warning'
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_check;
