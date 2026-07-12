import NextAuth from 'next-auth'
import authConfig from '@/auth.config'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'

const { auth } = NextAuth(authConfig)

// Routes that don't require authentication at all
const PUBLIC_ROUTES = ['/login', '/signup', '/superadmin/login', '/api/auth']

// Routes that require auth but NOT approval
const AUTH_ONLY_ROUTES = ['/pending', '/rejected', '/complete-registration']

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

    const url = request.nextUrl.clone()

    if (!profile?.ieee_membership_id) {
      url.pathname = '/complete-registration'
    } else if (profile?.status === 'pending') {
      url.pathname = '/pending'
    } else if (profile?.status === 'rejected') {
      url.pathname = '/rejected'
    } else {
      url.pathname = '/'
    }

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

    const url = request.nextUrl.clone()

    // No IEEE membership ID → needs to complete registration
    if (!profile?.ieee_membership_id) {
      url.pathname = '/complete-registration'
      return NextResponse.redirect(url)
    }

    // Not approved → route to appropriate page
    if (profile?.status === 'pending') {
      url.pathname = '/pending'
      return NextResponse.redirect(url)
    }

    if (profile?.status === 'rejected') {
      url.pathname = '/rejected'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}
