import NextAuth from 'next-auth'
import authConfig from '@/auth.config'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'

const { auth } = NextAuth(authConfig)

// Routes that don't require authentication at all
const PUBLIC_ROUTES = ['/login', '/signup', '/api/auth']

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
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged in + on login/signup → redirect based on status
  if (session?.user && (pathname === '/login' || pathname === '/signup')) {
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
