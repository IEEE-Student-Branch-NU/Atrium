// ============================================================
// Pure builders that turn rendered events (or custom sends) into the exact
// row shape the `notifications` table expects. Kept free of server/DB
// imports so the audience invariants can be unit-tested in isolation.
//
// The nullness rules here MUST mirror the DB CHECK constraint from
// migration 00011 (`notifications_audience_check`).
// ============================================================

import type {
  NotificationAudience,
  NotificationSeverity,
  RenderedNotification,
} from './events'

/** A row ready to insert into `public.notifications`. */
export interface NotificationRow {
  profile_id: string | null
  branch_id: string | null
  audience: NotificationAudience
  type: NotificationSeverity
  event_key: string | null
  actor_profile_id: string | null
  title: string
  message: string
  link: string | null
}

interface BuildContext {
  actorProfileId?: string | null
  /** Branch context to stamp even on user-audience rows (for oversight filtering). */
  branchId?: string | null
}

/** Personal notification to a single recipient (audience = 'user'). */
export function buildUserRow(
  profileId: string,
  rendered: RenderedNotification,
  ctx: BuildContext = {},
): NotificationRow {
  if (!profileId) throw new Error('buildUserRow: profileId is required')
  return {
    profile_id: profileId,
    branch_id: ctx.branchId ?? null,
    audience: 'user',
    type: rendered.type,
    event_key: rendered.event_key,
    actor_profile_id: ctx.actorProfileId ?? null,
    title: rendered.title,
    message: rendered.message,
    link: rendered.link,
  }
}

/** Branch-activity notification, visible to that branch's Chairs (audience = 'branch'). */
export function buildBranchRow(
  branchId: string,
  rendered: RenderedNotification,
  ctx: BuildContext = {},
): NotificationRow {
  if (!branchId) throw new Error('buildBranchRow: branchId is required')
  return {
    profile_id: null,
    branch_id: branchId,
    audience: 'branch',
    type: rendered.type,
    event_key: rendered.event_key,
    actor_profile_id: ctx.actorProfileId ?? null,
    title: rendered.title,
    message: rendered.message,
    link: rendered.link,
  }
}

/** Org-wide broadcast (audience = 'broadcast'). Single row; fanned out via RLS. */
export function buildBroadcastRow(
  content: { title: string; message: string; type?: NotificationSeverity; link?: string | null; event_key?: string | null },
  ctx: BuildContext = {},
): NotificationRow {
  return {
    profile_id: null,
    branch_id: null,
    audience: 'broadcast',
    type: content.type ?? 'info',
    event_key: content.event_key ?? 'broadcast.custom',
    actor_profile_id: ctx.actorProfileId ?? null,
    title: content.title,
    message: content.message,
    link: content.link ?? null,
  }
}

/**
 * Free-form super-admin send to an explicit target. Enforces the same
 * audience/nullness invariants as the catalog-driven builders.
 */
export function buildCustomRow(input: {
  audience: NotificationAudience
  title: string
  message: string
  type?: NotificationSeverity
  link?: string | null
  profileId?: string | null
  branchId?: string | null
  actorProfileId?: string | null
}): NotificationRow {
  const rendered: RenderedNotification = {
    event_key: 'broadcast.custom',
    audience: input.audience,
    type: input.type ?? 'info',
    channels: ['in_app'],
    title: input.title,
    message: input.message,
    link: input.link ?? null,
  }

  switch (input.audience) {
    case 'user':
      if (!input.profileId) throw new Error('buildCustomRow: user audience needs profileId')
      return buildUserRow(input.profileId, rendered, {
        actorProfileId: input.actorProfileId,
        branchId: input.branchId,
      })
    case 'branch':
      if (!input.branchId) throw new Error('buildCustomRow: branch audience needs branchId')
      return buildBranchRow(input.branchId, rendered, { actorProfileId: input.actorProfileId })
    case 'broadcast':
      return buildBroadcastRow(
        { title: input.title, message: input.message, type: input.type, link: input.link },
        { actorProfileId: input.actorProfileId },
      )
  }
}

/**
 * Runtime guard mirroring the DB CHECK. Returns true when the row satisfies
 * the audience/nullness invariants. Used in tests and as a defensive check.
 */
export function satisfiesAudienceInvariant(row: NotificationRow): boolean {
  switch (row.audience) {
    case 'user':
      return row.profile_id != null
    case 'branch':
      return row.branch_id != null && row.profile_id == null
    case 'broadcast':
      return row.profile_id == null
    default:
      return false
  }
}
