-- ============================================================
-- Migration 00011: Notification routing (audience + branch scope)
--
-- Extends the existing `notifications` table so notifications can be
-- routed to a single user, to a branch's Chairs, or to everyone, and so
-- super-admins can oversee all traffic while Chairs see their branch's
-- activity. Decouples routing (`audience`) from styling (`type`).
--
-- STEP ORDER MATTERS: add columns -> backfill -> swap CHECK ->
-- swap RLS policy -> indexes. Backfilling before the new CHECK avoids a
-- transient constraint violation.
-- ============================================================

-- 1. New columns ------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS audience         TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS branch_id        UUID REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS event_key        TEXT,
  ADD COLUMN IF NOT EXISTS actor_profile_id UUID REFERENCES profiles(id);

-- 2. Backfill legacy rows --------------------------------------
-- Legacy broadcasts were modelled as `type = 'broadcast'` with a NULL
-- profile_id. Move that into the new `audience` dimension, THEN collapse
-- the styling to a neutral severity. Order matters: the second UPDATE
-- still filters on `type = 'broadcast'`.
UPDATE public.notifications SET audience = 'broadcast' WHERE type = 'broadcast';
UPDATE public.notifications SET type = 'info'          WHERE type = 'broadcast';
-- Rows with a recipient keep the default audience = 'user'.

-- 3. Swap the recipient CHECK ----------------------------------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_check;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_audience_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_audience_check CHECK (
    (audience = 'user'      AND profile_id IS NOT NULL) OR
    (audience = 'branch'    AND branch_id IS NOT NULL AND profile_id IS NULL) OR
    (audience = 'broadcast' AND profile_id IS NULL)
  );

-- 4. Swap the RLS SELECT policy --------------------------------
-- Super-admin reads go through the service-role client (RLS bypassed).
-- This policy governs the browser/Realtime path only. A Chair (active
-- membership whose position name is 'Chair') may read branch-scoped
-- activity for that branch. `auth.uid()` comes from the minted JWT `sub`.
DROP POLICY IF EXISTS "Users can read own or broadcast notifications" ON public.notifications;
DROP POLICY IF EXISTS "read own, broadcast, or chair-branch" ON public.notifications;

CREATE POLICY "read own, broadcast, or chair-branch"
  ON public.notifications
  FOR SELECT
  USING (
    (audience = 'broadcast')
    OR (audience = 'user'   AND auth.uid()::text = profile_id::text)
    OR (audience = 'branch' AND EXISTS (
          SELECT 1
          FROM public.memberships m
          JOIN public.positions  p ON p.id = m.position_id
          WHERE m.profile_id = auth.uid()
            AND m.branch_id  = notifications.branch_id
            AND m.ended_at IS NULL
            AND p.name = 'Chair'))
  );

-- 5. Indexes ----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_branch_created
  ON public.notifications (branch_id, created_at DESC)
  WHERE audience = 'branch';

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_event
  ON public.notifications (event_key);
