'use server'

import { redirect } from 'next/navigation'
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, auth } from '@/auth'
import { AuthError } from 'next-auth'
import bcrypt from 'bcrypt'
import { createAdminClient } from '@/utils/supabase/server'
import { notifyUser } from '@/lib/notifications'

/**
 * Sign in with Google OAuth.
 * NextAuth handles the entire OAuth flow directly with GCP.
 */
export async function signInWithGoogle() {
  await nextAuthSignIn('google', { redirectTo: '/' })
}

/**
 * Sign in with email and password.
 * NextAuth's Credentials provider calls bcrypt.compare internally.
 */
export async function signInWithEmail(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  try {
    await nextAuthSignIn('credentials', {
      email,
      password,
      redirectTo: '/',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password.' }
    }
    throw error
  }
}

/**
 * Sign in as Superadmin with a fixed username + password.
 * The username is passed through NextAuth's Credentials provider in the
 * `email` field (the provider's field name); `src/auth.ts` matches it against
 * the hardcoded super-admin credentials — no email / Google account involved.
 */
export async function signInAsSuperadmin(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username and password are required.' }
  }

  try {
    await nextAuthSignIn('credentials', {
      email: username,
      password,
      isSuperAdminLogin: 'true',
      redirectTo: '/superadmin',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid superadmin credentials.' }
    }
    throw error
  }
}

/**
 * Sign up with email, password, and IEEE membership details.
 * Password is hashed with bcrypt before storing in the database.
 */
export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string
  const ieeeMembershipId = formData.get('ieeeMembershipId') as string
  const section = (formData.get('section') as string) || 'Gujarat Section'
  const branchSlug = (formData.get('branch') as string) || 'sbnu'
  const roleName = (formData.get('role') as string) || 'Member'

  // ── Validation ──────────────────────────────────────────
  if (!email || !password || !fullName || !ieeeMembershipId) {
    return { error: 'All required fields must be filled.' }
  }

  if (!email.endsWith('@nirmauni.ac.in')) {
    return { error: 'Only @nirmauni.ac.in email addresses are allowed.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  if (!/^\d{6,12}$/.test(ieeeMembershipId)) {
    return { error: 'IEEE Membership ID must be 6-12 digits.' }
  }

  if (phone && !/^\+91\s\d{5}\s\d{5}$/.test(phone)) {
    return { error: 'Phone number must be a valid Indian mobile number (e.g. +91 98765 43210).' }
  }

  const supabase = createAdminClient()

  // ── Check if email already exists ───────────────────────
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return { error: 'An account with this email already exists. Try logging in.' }
  }

  // ── Check if membership ID is already taken ─────────────
  const { data: existingMembership } = await supabase
    .from('profiles')
    .select('id')
    .eq('ieee_membership_id', ieeeMembershipId)
    .single()

  if (existingMembership) {
    return { error: 'This IEEE Membership ID is already registered to another account.' }
  }

  // ── Hash password with bcrypt ───────────────────────────
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)
  const passwordHash = await bcrypt.hash(password, saltRounds)

  // ── Check pre-approval ──────────────────────────────────
  const { data: preApproved } = await supabase
    .from('pre_approved_members')
    .select('id')
    .eq('ieee_membership_id', ieeeMembershipId)
    .single()

  const newStatus = preApproved ? 'approved' : 'pending'

  // ── Insert profile directly into the database ───────────
  const { data: profileData, error: insertError } = await supabase.from('profiles').insert({
    email,
    full_name: fullName,
    password_hash: passwordHash,
    phone: phone || null,
    ieee_membership_id: ieeeMembershipId,
    section,
    status: newStatus,
    ...(preApproved ? { approved_at: new Date().toISOString() } : {}),
  }).select('id').single()

  if (insertError) {
    console.error('Signup insert error:', insertError)
    return { error: 'Failed to create account. Please try again.' }
  }

  // ── Create initial membership ───────────────────────────
  await assignMembership(supabase, profileData.id, branchSlug, roleName)

  // ── Welcome the new member (in-app + email) ─────────────
  await notifyUser({ profileId: profileData.id, event: 'welcome', params: { name: fullName } })

  // ── Auto sign-in after successful signup ────────────────
  try {
    await nextAuthSignIn('credentials', {
      email,
      password,
      redirectTo: newStatus === 'approved' ? '/' : '/pending',
    })
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    // If auto-signin fails, redirect to login
    redirect('/login')
  }
}

/**
 * Complete registration for Google OAuth users who
 * authenticated but haven't filled in IEEE details yet.
 */
export async function completeRegistration(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const phone = formData.get('phone') as string
  const ieeeMembershipId = formData.get('ieeeMembershipId') as string
  const section = (formData.get('section') as string) || 'Gujarat Section'
  const branchSlug = (formData.get('branch') as string) || 'sbnu'
  const roleName = (formData.get('role') as string) || 'Member'

  if (!ieeeMembershipId) {
    return { error: 'IEEE Membership ID is required.' }
  }

  if (!/^\d{6,12}$/.test(ieeeMembershipId)) {
    return { error: 'IEEE Membership ID must be 6-12 digits.' }
  }

  if (phone && !/^\+91\s?\d{5}\s?\d{5}$/.test(phone)) {
    return { error: 'Phone number must be a valid Indian mobile number (e.g. +91 98765 43210).' }
  }

  const supabase = createAdminClient()

  // Check pre-approval
  const { data: preApproved } = await supabase
    .from('pre_approved_members')
    .select('id')
    .eq('ieee_membership_id', ieeeMembershipId)
    .single()

  const newStatus = preApproved ? 'approved' : 'pending'

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      phone: phone || null,
      ieee_membership_id: ieeeMembershipId,
      section,
      status: newStatus,
      ...(preApproved ? { approved_at: new Date().toISOString() } : {}),
    })
    .eq('id', session.user.id)

  if (profileError) {
    if (profileError.message.includes('unique') || profileError.message.includes('duplicate')) {
      return { error: 'This IEEE Membership ID is already registered to another account.' }
    }
    return { error: 'Failed to save details. Please try again.' }
  }

  // ── Create initial membership ───────────────────────────
  await assignMembership(supabase, session.user.id, branchSlug, roleName)

  // ── Welcome the new member (in-app + email) ─────────────
  await notifyUser({
    profileId: session.user.id,
    event: 'welcome',
    params: { name: session.user.name ?? null },
  })

  if (newStatus === 'approved') {
    redirect('/')
  } else {
    redirect('/pending')
  }
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  await nextAuthSignOut({ redirectTo: '/login' })
}

/**
 * Helper to assign initial membership
 */
async function assignMembership(supabase: any, profileId: string, branchSlug: string, roleName: string) {
  try {
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('slug', branchSlug)
      .single()
      
    if (!branch) return

    let positionId = null
    if (roleName !== 'Member') {
      const { data: position } = await supabase
        .from('positions')
        .select('id')
        .eq('branch_id', branch.id)
        .eq('name', roleName)
        .single()
      if (position) {
        positionId = position.id
      }
    }
    
    await supabase.from('memberships').insert({
      profile_id: profileId,
      branch_id: branch.id,
      position_id: positionId,
    })
  } catch (err) {
    console.error('Failed to assign membership:', err)
  }
}
