import 'server-only'

// ============================================================
// The single write path for all notifications. Every automated trigger and
// the super-admin send dialog route through here. Inserts the in-app row(s)
// and, for email-enabled events, sends email best-effort.
//
// Best-effort contract: a notification (or its email) failing must NEVER
// throw into the calling server action — mirrors `logAdminAction`.
// ============================================================

import { createAdminClient } from '@/utils/supabase/server'
import {
  renderEvent,
  eventSendsEmail,
  type NotificationEventKey,
  type NotificationParams,
  type NotificationAudience,
  type NotificationSeverity,
} from './events'
import {
  buildUserRow,
  buildBranchRow,
  buildBroadcastRow,
  buildCustomRow,
  satisfiesAudienceInvariant,
  type NotificationRow,
} from './payload'

type Supabase = ReturnType<typeof createAdminClient>

/** Insert notification rows, skipping any that violate the audience invariant. */
async function insertRows(supabase: Supabase, rows: NotificationRow[]): Promise<void> {
  const valid = rows.filter((r) => {
    const ok = satisfiesAudienceInvariant(r)
    if (!ok) console.error('[notify] dropped row violating audience invariant', r)
    return ok
  })
  if (valid.length === 0) return
  const { error } = await supabase.from('notifications').insert(valid)
  if (error) console.error('[notify] insert failed', error)
}

// ── Public API ───────────────────────────────────────────────

/** Notify a single member of a catalog event. */
export async function notifyUser(input: {
  profileId: string
  event: NotificationEventKey
  params?: NotificationParams
  actorProfileId?: string | null
  branchId?: string | null
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    const rendered = renderEvent(input.event, input.params)
    const row = buildUserRow(input.profileId, rendered, {
      actorProfileId: input.actorProfileId,
      branchId: input.branchId,
    })
    await insertRows(supabase, [row])
  } catch (err) {
    console.error('[notify] notifyUser failed', err)
  }
}

/** Notify a branch's Chairs of a catalog event (branch-activity feed). */
export async function notifyBranch(input: {
  branchId: string
  event: NotificationEventKey
  params?: NotificationParams
  actorProfileId?: string | null
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    const rendered = renderEvent(input.event, input.params)
    const row = buildBranchRow(input.branchId, rendered, { actorProfileId: input.actorProfileId })
    await insertRows(supabase, [row])
  } catch (err) {
    console.error('[notify] notifyBranch failed', err)
  }
}

/** Org-wide broadcast. In-app only (never email — avoids org-wide blasts). */
export async function notifyBroadcast(input: {
  title: string
  message: string
  type?: NotificationSeverity
  link?: string | null
  actorProfileId?: string | null
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    const row = buildBroadcastRow(
      { title: input.title, message: input.message, type: input.type, link: input.link },
      { actorProfileId: input.actorProfileId },
    )
    await insertRows(supabase, [row])
  } catch (err) {
    console.error('[notify] notifyBroadcast failed', err)
  }
}

/**
 * Free-form super-admin send to an explicit target (user / branch / broadcast).
 * For 'user' targets whose email should also go out, pass `email: true`.
 */
export async function notifyCustom(input: {
  audience: NotificationAudience
  title: string
  message: string
  type?: NotificationSeverity
  link?: string | null
  profileId?: string | null
  branchId?: string | null
  actorProfileId?: string | null
  email?: boolean
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    const row = buildCustomRow(input)
    await insertRows(supabase, [row])
  } catch (err) {
    console.error('[notify] notifyCustom failed', err)
  }
}
