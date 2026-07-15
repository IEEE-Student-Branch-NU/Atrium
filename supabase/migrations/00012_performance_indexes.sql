-- ============================================================
-- Migration 00012: Performance indexes
--
-- Supporting indexes for the hottest read paths. These are additive and
-- safe to apply at any time. Optional — the app works without them, but
-- they keep the status/date filters fast as the tables grow.
--
-- Apply manually in the Supabase SQL editor (project convention).
-- ============================================================

-- profiles.status — powers the dashboard member/pending counts, the
-- registration-approval queue, the members directory (status='approved'),
-- and the analytics funnel. Filtered on nearly every dashboard load.
CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON public.profiles (status);

-- profiles.created_at — the analytics 30-day registration trend and any
-- newest-first ordering of members.
CREATE INDEX IF NOT EXISTS idx_profiles_created_at
  ON public.profiles (created_at DESC);

-- position_requests decisions history / super-admin decided list orders by
-- decided_at; index the decided rows for that ordering.
CREATE INDEX IF NOT EXISTS idx_position_requests_decided_at
  ON public.position_requests (decided_at DESC)
  WHERE status IN ('approved', 'rejected');
