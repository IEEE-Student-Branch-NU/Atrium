// ============================================================
// Minimal, dependency-free HTML email template. One shared shell keeps every
// Atrium email visually consistent; the notification's title/message/CTA are
// slotted in. Kept pure (no server imports) for easy testing.
// ============================================================

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Resolve a possibly-relative link to an absolute URL using APP_URL. */
function absoluteUrl(link: string | null | undefined): string | null {
  if (!link) return null
  if (/^https?:\/\//i.test(link)) return link
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '')
  if (!base) return null
  return `${base}${link.startsWith('/') ? '' : '/'}${link}`
}

export interface EmailContent {
  subject: string
  html: string
  text: string
}

export function renderEmail(input: {
  title: string
  message: string
  link?: string | null
  ctaLabel?: string
}): EmailContent {
  const title = escapeHtml(input.title)
  const message = escapeHtml(input.message)
  const href = absoluteUrl(input.link)
  const ctaLabel = escapeHtml(input.ctaLabel || 'Open Atrium')

  const cta = href
    ? `<tr><td style="padding-top:24px">
         <a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px">${ctaLabel}</a>
       </td></tr>`
    : ''

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;text-align:left">
          <tr><td style="font-size:13px;font-weight:700;letter-spacing:.08em;color:#4f46e5;text-transform:uppercase">Atrium</td></tr>
          <tr><td style="padding-top:12px;font-size:20px;font-weight:700;color:#18181b">${title}</td></tr>
          <tr><td style="padding-top:8px;font-size:15px;line-height:1.6;color:#3f3f46">${message}</td></tr>
          ${cta}
          <tr><td style="padding-top:28px;border-top:1px solid #e4e4e7;margin-top:24px;font-size:12px;color:#a1a1aa">
            You're receiving this because you have an Atrium account (IEEE SBNU).
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  const text = href ? `${input.title}\n\n${input.message}\n\n${ctaLabel}: ${href}` : `${input.title}\n\n${input.message}`

  return { subject: input.title, html, text }
}
