'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { notifyBranch } from '@/lib/notifications'
import bcrypt from 'bcrypt'

/**
 * Update the current user's profile information.
 */
export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Not authenticated' }
  }

  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string
  const bio = formData.get('bio') as string
  const skillsRaw = formData.get('skills') as string

  // Parse skills from comma-separated string
  const skills = skillsRaw
    ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : null

  if (!fullName || fullName.trim().length < 2) {
    return { error: 'Full name is required (at least 2 characters).' }
  }

  if (phone && !/^\+91\s?\d{5}\s?\d{5}$/.test(phone)) {
    return { error: 'Phone number must be a valid Indian mobile number (e.g. +91 98765 43210).' }
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName.trim(),
      phone: phone || null,
      bio: bio || null,
      skills: skills && skills.length > 0 ? skills : null,
    })
    .eq('id', session.user.id)

  if (error) {
    console.error('Profile update error:', error)
    return { error: 'Failed to update profile. Please try again.' }
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Change the current user's password.
 */
export async function changePassword(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Not authenticated' }
  }

  const currentPassword = formData.get('currentPassword') as string | null
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!newPassword || !confirmPassword) {
    return { error: 'New password and confirm password are required.' }
  }

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.' }
  }

  const supabase = createAdminClient()

  // Get current password hash
  const { data: profile } = await supabase
    .from('profiles')
    .select('password_hash')
    .eq('id', session.user.id)
    .single()

  const hasPassword = !!profile?.password_hash

  if (hasPassword) {
    if (!currentPassword) {
      return { error: 'Current password is required to change password.' }
    }
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, profile.password_hash)
    if (!isValid) {
      return { error: 'Current password is incorrect.' }
    }
  }

  // Hash new password
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)
  const newHash = await bcrypt.hash(newPassword, saltRounds)

  const { error } = await supabase
    .from('profiles')
    .update({ password_hash: newHash })
    .eq('id', session.user.id)

  if (error) {
    console.error('Password change error:', error)
    return { error: 'Failed to change password. Please try again.' }
  }

  // Audit log
  await supabase.from('membership_audit_log').insert({
    profile_id: session.user.id,
    branch_id: (await supabase
      .from('memberships')
      .select('branch_id')
      .eq('profile_id', session.user.id)
      .is('ended_at', null)
      .limit(1)
      .single()).data?.branch_id,
    action: 'password_changed',
    changed_by: session.user.id,
    details: { timestamp: new Date().toISOString() },
  })

  return { success: true }
}

/**
 * Update the user's membership details (IEEE ID).
 * Requires current password.
 */
export async function updateMembershipDetails(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Not authenticated' }
  }

  const ieeeMembershipId = formData.get('ieeeMembershipId') as string
  const currentPassword = formData.get('currentPassword') as string

  if (!currentPassword) {
    return { error: 'Current password is required to update membership details.' }
  }

  const supabase = createAdminClient()

  // Get current password hash
  const { data: profile } = await supabase
    .from('profiles')
    .select('password_hash')
    .eq('id', session.user.id)
    .single()

  const hasPassword = !!profile?.password_hash

  if (!hasPassword) {
    return { error: 'Please set a password first using the Security section.' }
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, profile.password_hash)
  if (!isValid) {
    return { error: 'Current password is incorrect.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ieee_membership_id: ieeeMembershipId || null })
    .eq('id', session.user.id)

  if (error) {
    console.error('Membership update error:', error)
    return { error: 'Failed to update membership details. Please try again.' }
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Submit a request for a new position.
 */
export async function requestPosition(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Not authenticated' }
  }

  const branchId = formData.get('branchId') as string
  const positionId = formData.get('positionId') as string
  const reason = formData.get('reason') as string
  const description = formData.get('description') as string
  const supportingNotes = formData.get('supportingNotes') as string

  if (!branchId || !positionId || !reason) {
    return { error: 'Branch, position, and reason are required.' }
  }

  if (reason.trim().length < 10) {
    return { error: 'Please provide a more detailed reason (at least 10 characters).' }
  }

  const supabase = createAdminClient()

  // Check for duplicate pending requests
  const { data: existing } = await supabase
    .from('position_requests')
    .select('id')
    .eq('profile_id', session.user.id)
    .eq('branch_id', branchId)
    .eq('position_id', positionId)
    .in('status', ['pending', 'under_review'])
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'You already have a pending request for this position.' }
  }

  // Check if user already holds this position
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('profile_id', session.user.id)
    .eq('branch_id', branchId)
    .eq('position_id', positionId)
    .is('ended_at', null)
    .limit(1)

  if (existingMembership && existingMembership.length > 0) {
    return { error: 'You already hold this position.' }
  }

  const { error } = await supabase.from('position_requests').insert({
    profile_id: session.user.id,
    branch_id: branchId,
    position_id: positionId,
    reason: reason.trim(),
    description: description?.trim() || null,
    supporting_notes: supportingNotes?.trim() || null,
  })

  if (error) {
    console.error('Position request error:', error)
    return { error: 'Failed to submit request. Please try again.' }
  }

  // Alert the branch's Chair(s) that a new request needs review.
  const [{ data: requester }, { data: position }, { data: branch }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', session.user.id).single(),
    supabase.from('positions').select('name').eq('id', positionId).single(),
    supabase.from('branches').select('name').eq('id', branchId).single(),
  ])
  await notifyBranch({
    branchId,
    event: 'position_request.submitted',
    params: {
      name: requester?.full_name ?? null,
      position: position?.name ?? null,
      branch: branch?.name ?? null,
    },
    actorProfileId: session.user.id,
  })

  revalidatePath('/profile')
  return { success: true }
}
