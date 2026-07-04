'use server'

import { redirect } from 'next/navigation'
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, auth } from '@/auth'
import bcrypt from 'bcrypt'
import { createAdminClient } from '@/utils/supabase/server'

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
  } catch (error: any) {
    // NextAuth throws a NEXT_REDIRECT on success — re-throw it
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    return { error: 'Invalid email or password.' }
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
  const { error: insertError } = await supabase.from('profiles').insert({
    email,
    full_name: fullName,
    password_hash: passwordHash,
    phone: phone || null,
    ieee_membership_id: ieeeMembershipId,
    section,
    status: newStatus,
    ...(preApproved ? { approved_at: new Date().toISOString() } : {}),
  })

  if (insertError) {
    console.error('Signup insert error:', insertError)
    return { error: 'Failed to create account. Please try again.' }
  }

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

  if (!ieeeMembershipId) {
    return { error: 'IEEE Membership ID is required.' }
  }

  if (!/^\d{6,12}$/.test(ieeeMembershipId)) {
    return { error: 'IEEE Membership ID must be 6-12 digits.' }
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
