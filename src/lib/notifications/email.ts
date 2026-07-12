import 'server-only'

// ============================================================
// Email delivery via the Resend REST API (no SDK dependency — plain fetch).
//
// Best-effort by design: if RESEND_API_KEY / EMAIL_FROM are not configured
// (local dev, CI, or before the domain is verified) every send is a logged
// no-op. A failed email must NEVER break the action that triggered it, so
// callers should not await this for correctness — mirror `logAdminAction`.
// ============================================================

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

/** True when Resend is configured enough to actually send. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

/**
 * Send an email. Returns `{ sent: false }` (never throws) when unconfigured
 * or on transport failure, so notification flows degrade gracefully.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailConfigured()) {
    console.info('[email] skipped (RESEND_API_KEY/EMAIL_FROM not set):', msg.subject)
    return { sent: false, reason: 'not_configured' }
  }

  const recipients = Array.isArray(msg.to) ? msg.to.filter(Boolean) : [msg.to].filter(Boolean)
  if (recipients.length === 0) {
    return { sent: false, reason: 'no_recipients' }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: recipients,
        subject: msg.subject,
        html: msg.html,
        ...(msg.text ? { text: msg.text } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[email] Resend responded', res.status, body)
      return { sent: false, reason: `http_${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.error('[email] send failed', err)
    return { sent: false, reason: 'exception' }
  }
}
