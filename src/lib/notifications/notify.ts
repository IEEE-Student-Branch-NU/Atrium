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
import { sendEmail } from './email'
import { renderEmail } from './templates'

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

async function emailProfiles(supabase: Supabase, profileIds: string[], content: { title: string; message: string; link: string | null }): Promise<void> {
  if (profileIds.length === 0) return
  const { data } = await supabase.from('profiles').select('email').in('id', profileIds)
  const emails = (data ?? []).map((r) => r.email).filter(Boolean) as string[]
  if (emails.length === 0) return
  const mail = renderEmail(content)
  await sendEmail({ to: emails, subject: mail.subject, html: mail.html, text: mail.text })
}

/** Emails of the active Chairs of a branch. */
async function branchChairEmails(supabase: Supabase, branchId: string): Promise<string[]> {
  const { data } = await supabase
    .from('memberships')
    .select('profiles(email), positions!inner(name)')
    .eq('branch_id', branchId)
    .is('ended_at', null)
    .eq('positions.name', 'Chair')
  return (data ?? [])
    .map((m) => (m.profiles as unknown as { email: string | null } | null)?.email)
    .filter(Boolean) as string[]
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

    if (eventSendsEmail(input.event)) {
      await emailProfiles(supabase, [input.profileId], {
        title: rendered.title,
        message: rendered.message,
        link: rendered.link,
      })
    }
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

    if (eventSendsEmail(input.event)) {
      const emails = await branchChairEmails(supabase, input.branchId)
      if (emails.length > 0) {
        const mail = renderEmail({ title: rendered.title, message: rendered.message, link: rendered.link })
        await sendEmail({ to: emails, subject: mail.subject, html: mail.html, text: mail.text })
      }
    }
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

    if (input.email && input.audience === 'user' && input.profileId) {
      await emailProfiles(supabase, [input.profileId], {
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      })
    } else if (input.email && input.audience === 'branch' && input.branchId) {
      const emails = await branchChairEmails(supabase, input.branchId)
      if (emails.length > 0) {
        const mail = renderEmail({ title: input.title, message: input.message, link: input.link ?? null })
        await sendEmail({ to: emails, subject: mail.subject, html: mail.html, text: mail.text })
      }
    }
  } catch (err) {
    console.error('[notify] notifyCustom failed', err)
  }
}
