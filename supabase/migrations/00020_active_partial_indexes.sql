-- ============================================================
-- Migration 00020: Partial indexes for the append-only hot reads
--
-- `memberships` and `member_permissions` are APPEND-ONLY (see
-- docs/ENGINEERING.md §4): rows are never deleted, only timestamped
-- (`ended_at` / `revoked_at`). Every *active* read therefore filters on the
-- `IS NULL` predicate, and the set of historical (closed) rows grows without
-- bound over the org's lifetime.
--
-- The existing indexes (`idx_memberships_active`,
-- `idx_member_permissions_active`) are plain composites with NO `WHERE`
-- clause, so they still index every dead historical row and the planner must
-- filter `ended_at IS NULL` / `revoked_at IS NULL` as a residual. These
-- PARTIAL indexes index only the live rows — smaller, and matched exactly to
-- the predicate that the effective-actor, portal-layout, members-directory,
-- and permission reads all apply on every request.
--
-- Additive and safe to apply at any time. Apply manually in the Supabase SQL
-- editor (project convention — there is no migration runner).
-- ============================================================

-- Active-membership lookups by profile: getEffectiveActor, portal layout
-- (getUserProfileWithMembership / getAllUserMemberships), members directory,
-- and both permission paths all run `.eq('profile_id', ...).is('ended_at', null)`.
CREATE INDEX IF NOT EXISTS idx_memberships_profile_active
  ON public.memberships (profile_id)
  WHERE ended_at IS NULL;

-- Direct permission grants: getUserPermissions runs
-- `.eq('profile_id', ...).eq('branch_id', ...).is('revoked_at', null)`.
CREATE INDEX IF NOT EXISTS idx_member_permissions_profile_branch_active
  ON public.member_permissions (profile_id, branch_id)
  WHERE revoked_at IS NULL;
