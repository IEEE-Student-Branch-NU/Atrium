// ============================================================
// Notification event catalog — the single source of truth for every
// automated notification. Pure module (no server/DB imports) so it can be
// unit-tested directly.
//
// `type`     = visual severity (styling only)
// `audience` = routing target (who receives / can see it)
// `channels` = delivery surfaces (in-app always; email for high-signal events)
// ============================================================

export type NotificationSeverity =
  | 'normal'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type NotificationAudience = 'user' | 'branch' | 'broadcast'

export type NotificationChannel = 'in_app' | 'email'

/** Loose bag of template values. Missing values render as an empty string. */
export type NotificationParams = Record<string, string | number | null | undefined>

export interface NotificationEvent {
  /** Stable machine key, e.g. 'registration.approved'. */
  key: string
  audience: NotificationAudience
  type: NotificationSeverity
  channels: NotificationChannel[]
  title: string
  /** Build the human-facing body from template params. */
  buildMessage: (params: NotificationParams) => string
  /** Optional deep link the notification points to. */
  buildLink?: (params: NotificationParams) => string | null
}

/** Coerce a template value to a display string ('' for null/undefined). */
function s(v: string | number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

/** ` in Branch` / ` of Branch` suffix helper (empty when no branch given). */
function withBranch(prefix: string, branch: NotificationParams['branch']): string {
  const b = s(branch)
  return b ? `${prefix}${b}` : ''
}

// ── The catalog ──────────────────────────────────────────────

export const NOTIFICATION_EVENTS = {
  // ── Welcome / onboarding ──
  welcome: {
    key: 'welcome',
    audience: 'user',
    type: 'success',
    channels: ['in_app', 'email'],
    title: 'Welcome to Atrium 🎉',
    buildMessage: (p) =>
      `Hi ${s(p.name) || 'there'}, welcome to Atrium! Thanks for signing up — we're glad to have you.`,
    buildLink: () => '/',
  },
  'membership.added': {
    key: 'membership.added',
    audience: 'user',
    type: 'info',
    channels: ['in_app'],
    title: 'Added to a branch',
    buildMessage: (p) =>
      `You've been added to ${s(p.branch) || 'a branch'}${p.position ? ` as ${s(p.position)}` : ''}.`,
    buildLink: () => '/profile#positions',
  },

  // ── Approvals & rejections ──
  'registration.approved': {
    key: 'registration.approved',
    audience: 'user',
    type: 'success',
    channels: ['in_app', 'email'],
    title: 'Registration approved ✅',
    buildMessage: (p) =>
      `Your Atrium registration has been approved. Welcome aboard${p.name ? `, ${s(p.name)}` : ''}!`,
    buildLink: () => '/',
  },
  'registration.rejected': {
    key: 'registration.rejected',
    audience: 'user',
    type: 'error',
    channels: ['in_app', 'email'],
    title: 'Registration not approved',
    buildMessage: (p) =>
      `Your registration was not approved.${p.reason ? ` Reason: ${s(p.reason)}` : ''}`,
    buildLink: () => null,
  },
  'position_request.submitted': {
    key: 'position_request.submitted',
    audience: 'branch',
    type: 'info',
    channels: ['in_app'],
    title: 'New position request',
    buildMessage: (p) =>
      `${s(p.name) || 'A member'} requested the ${s(p.position) || 'a'} position${withBranch(' in ', p.branch)}.`,
    buildLink: () => '/position-requests',
  },
  'position_request.approved': {
    key: 'position_request.approved',
    audience: 'user',
    type: 'success',
    channels: ['in_app', 'email'],
    title: 'Position request approved',
    buildMessage: (p) =>
      `Your request for ${s(p.position) || 'a new position'}${withBranch(' in ', p.branch)} has been approved.`,
    buildLink: () => '/profile#positions',
  },
  'position_request.rejected': {
    key: 'position_request.rejected',
    audience: 'user',
    type: 'error',
    channels: ['in_app', 'email'],
    title: 'Position request rejected',
    buildMessage: (p) =>
      `Your request for ${s(p.position) || 'a new position'} was rejected.${p.reason ? ` Reason: ${s(p.reason)}` : ''}`,
    buildLink: () => '/profile#positions',
  },

  // ── Promotion / role & position change ──
  'member.promoted': {
    key: 'member.promoted',
    audience: 'user',
    type: 'success',
    channels: ['in_app', 'email'],
    title: 'You have a new position 🎉',
    buildMessage: (p) =>
      `You're now ${s(p.position) || 'in a new position'}${withBranch(' of ', p.branch)}.`,
    buildLink: () => '/profile#positions',
  },
  'member.position_removed': {
    key: 'member.position_removed',
    audience: 'user',
    type: 'warning',
    channels: ['in_app'],
    title: 'Position ended',
    buildMessage: (p) =>
      `Your ${s(p.position) || 'previous'} position${withBranch(' in ', p.branch)} has ended.`,
    buildLink: () => '/profile#positions',
  },
  'permission.granted': {
    key: 'permission.granted',
    audience: 'user',
    type: 'info',
    channels: ['in_app'],
    title: 'New permission granted',
    buildMessage: (p) =>
      `You were granted the "${s(p.permission)}" permission${withBranch(' in ', p.branch)}.`,
    buildLink: () => '/profile',
  },
  'permission.revoked': {
    key: 'permission.revoked',
    audience: 'user',
    type: 'warning',
    channels: ['in_app'],
    title: 'Permission revoked',
    buildMessage: (p) =>
      `Your "${s(p.permission)}" permission${withBranch(' in ', p.branch)} was revoked.`,
    buildLink: () => '/profile',
  },

  // ── Lifecycle / admin (event.* are DEFERRED — no event-lifecycle
  //    server actions exist yet; catalog entries are ready for wiring) ──
  'event.submitted': {
    key: 'event.submitted',
    audience: 'branch',
    type: 'info',
    channels: ['in_app'],
    title: 'Event awaiting approval',
    buildMessage: (p) =>
      `${s(p.event) || 'An event'} was submitted for approval${withBranch(' in ', p.branch)}.`,
    buildLink: () => '/approvals',
  },
  'event.approved': {
    key: 'event.approved',
    audience: 'user',
    type: 'success',
    channels: ['in_app'],
    title: 'Event approved',
    buildMessage: (p) => `Your event "${s(p.event)}" has been approved.`,
    buildLink: () => '/events',
  },
  'event.rejected': {
    key: 'event.rejected',
    audience: 'user',
    type: 'error',
    channels: ['in_app'],
    title: 'Event rejected',
    buildMessage: (p) =>
      `Your event "${s(p.event)}" was rejected.${p.reason ? ` Reason: ${s(p.reason)}` : ''}`,
    buildLink: () => '/events',
  },
  'event.published': {
    key: 'event.published',
    audience: 'user',
    type: 'success',
    channels: ['in_app'],
    title: 'Event published',
    buildMessage: (p) => `Your event "${s(p.event)}" is now live.`,
    buildLink: () => '/events',
  },
} satisfies Record<string, NotificationEvent>

export type NotificationEventKey = keyof typeof NOTIFICATION_EVENTS

/** Resolved, ready-to-store notification content for an event. */
export interface RenderedNotification {
  // `string`, not NotificationEventKey — custom sends use synthetic keys like 'broadcast.custom'.
  event_key: string
  audience: NotificationAudience
  type: NotificationSeverity
  channels: NotificationChannel[]
  title: string
  message: string
  link: string | null
}

/** Render a catalog event into concrete title/message/link for a given params bag. */
export function renderEvent(
  key: NotificationEventKey,
  params: NotificationParams = {},
): RenderedNotification {
  // View through the interface so channels/buildLink aren't over-narrowed by the literal.
  const event: NotificationEvent = NOTIFICATION_EVENTS[key]
  return {
    event_key: key,
    audience: event.audience,
    type: event.type,
    channels: [...event.channels],
    title: event.title,
    message: event.buildMessage(params),
    link: event.buildLink ? event.buildLink(params) : null,
  }
}


