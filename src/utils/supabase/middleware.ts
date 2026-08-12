import NextAuth from 'next-auth'
import authConfig from '@/auth.config'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'

const { auth } = NextAuth(authConfig)

// Routes that don't require authentication at all
const PUBLIC_ROUTES = ['/login', '/signup', '/superadmin/login', '/api/auth', '/api/public']

// Routes that require auth but NOT approval
const AUTH_ONLY_ROUTES = ['/pending', '/rejected', '/complete-registration']

/**
 * The single portal gate. Fail-closed by design: `approved` is the *only* status
 * that returns null (= let them through). Everything else — `pending`,
 * `under_review`, and any status added to the `registration_status` enum later —
 * lands on `/pending` rather than falling through into the portal.
 *
 * This shape matters: the previous version was a deny-list that named only
 * `pending` and `rejected`, so `under_review` (added in migration 00015) matched
 * neither branch and silently granted portal access.
 *
 * A missing profile means the row was hard-deleted out from under a still-valid
 * NextAuth JWT — send them to `/login`, never to `/complete-registration`, which
 * is auth-only and would let them re-register on the deleted identity.
 */
function gateRedirectPath(
  profile: { status?: string | null; ieee_membership_id?: string | null } | null
): string | null {
  if (!profile) return '/login'
  if (!profile.ieee_membership_id) return '/complete-registration'
  if (profile.status === 'approved') return null
  if (profile.status === 'rejected') return '/rejected'
  return '/pending'
}

export async function authMiddleware(request: NextRequest) {
  const session = await auth()
  const pathname = request.nextUrl.pathname

  // Skip checks for static assets
  const isPublicAsset =
    pathname.startsWith('/_next') || pathname.match(/\.(.*)$/)
  if (isPublicAsset) return NextResponse.next()

  // Check if this is a public route (no auth needed)
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  // Not logged in + not on a public route → redirect to login
  if (!session?.user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    if (pathname.startsWith('/superadmin')) {
      url.pathname = '/superadmin/login'
    } else {
      url.pathname = '/login'
    }
    return NextResponse.redirect(url)
  }

  // Edge-safe super-admin flag, set on the session by the jwt/session
  // callbacks in auth.config.ts (Task 3). Never call isSuperAdmin() from
  // @/utils/auth/superadmin here — it uses bcrypt, which is not Edge-safe.
  const isSA = session?.isSuperAdmin === true

  if (isSA) {
    // Presence of the impersonation cookie means the super admin is viewing a
    // member's workspace in the portal at `/`. The cookie name mirrors
    // IMPERSONATE_COOKIE in @/utils/auth/impersonation (hardcoded here to avoid
    // importing that server-only module into the Edge bundle); full crypto
    // verification happens server-side in getEffectiveActor.
    const impersonating = request.cookies.has('atrium_impersonate')

    // Not impersonating → send them into their portal from any entry point.
    if (
      !impersonating &&
      (pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname === '/superadmin/login')
    ) {
      return NextResponse.redirect(new URL('/superadmin', request.url))
    }

    // Super admins bypass all registration/approval status gating (they have
    // full access); while impersonating they stay in the member portal at `/`.
    return NextResponse.next()
  }

  // Non-super-admins may not access the portal.
  if (pathname.startsWith('/superadmin') && pathname !== '/superadmin/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Logged in + on login/signup → redirect based on status
  if (session?.user && (pathname === '/login' || pathname === '/signup' || pathname === '/superadmin/login')) {
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('status, ieee_membership_id')
      .eq('id', session.user.id)
      .single()

    const dest = gateRedirectPath(profile) ?? '/'

    // A hard-deleted profile resolves to '/login', which is where they already
    // are — render the login page instead of redirecting to it forever. Their
    // stale NextAuth cookie is replaced on the next successful sign-in.
    if (dest === pathname) return NextResponse.next()

    const url = request.nextUrl.clone()
    url.pathname = dest

    return NextResponse.redirect(url)
  }

  // Logged in + on a protected route → check approval status
  const isAuthOnlyRoute = AUTH_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  if (session?.user && !isPublicRoute && !isAuthOnlyRoute) {
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('status, ieee_membership_id')
      .eq('id', session.user.id)
      .single()

    const dest = gateRedirectPath(profile)
    if (dest) {
      const url = request.nextUrl.clone()
      url.pathname = dest
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}
