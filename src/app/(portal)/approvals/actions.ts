'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getUserProfileWithMembership } from '@/lib/queries'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { notifyUser } from '@/lib/notifications'
import { logAdminAction } from '@/utils/auth/audit'

export async function approveRegistration(profileId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const activeMembershipId = await getActiveWorkspace()
  const profile = await getUserProfileWithMembership(session.user.id, activeMembershipId)
  if (!profile) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  if (!hasPermission(permissions, 'approve_registrations')) {
    throw new Error('Forbidden: Missing approve_registrations permission')
  }

  // Check branch scope
  if (!permissions.includes('*')) {
    const { data: mems } = await supabase.from('memberships').select('branch_id').eq('profile_id', profileId)
    const hasBranch = mems?.some(m => m.branch_id === profile.branch_id)
    if (!hasBranch) throw new Error('Forbidden: You can only manage members of your own branch.')
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      status: 'approved',
      approved_by: session.user.id,
      approved_by_position: profile.position_name || (session.isSuperAdmin ? 'Superadmin' : 'Admin'), // Store the active position name or fallback to Superadmin
      approved_at: new Date().toISOString(),
      rejected_reason: null, // Clear any past rejection
    })
    .in('status', ['pending', 'under_review']) // Allow approving from pending or under_review
    .eq('id', profileId)
    .select('id, full_name')

  if (error) {
    throw new Error(error.message)
  }

  // Only notify if a row actually transitioned.
  if (updated && updated.length > 0) {
    await notifyUser({
      profileId,
      event: 'registration.approved',
      params: { name: updated[0].full_name },
      actorProfileId: session.user.id,
    })

    await logAdminAction({
      actorProfileId: session.user.id,
      action: 'member_added',
      entityType: 'user',
      entityId: profileId,
      branchId: profile.branch_id,
      summary: `Approved registration for "${updated[0].full_name}"`
    })
  }

  revalidatePath('/approvals')
  revalidatePath('/superadmin/approvals')
  revalidatePath('/')
  return { success: true }
}

export async function markUnderReview(profileId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const activeMembershipId = await getActiveWorkspace()
  const profile = await getUserProfileWithMembership(session.user.id, activeMembershipId)
  if (!profile) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  if (!hasPermission(permissions, 'approve_registrations')) {
    throw new Error('Forbidden: Missing approve_registrations permission')
  }

  // Check branch scope
  if (!permissions.includes('*')) {
    const { data: mems } = await supabase.from('memberships').select('branch_id').eq('profile_id', profileId)
    const hasBranch = mems?.some(m => m.branch_id === profile.branch_id)
    if (!hasBranch) throw new Error('Forbidden: You can only manage members of your own branch.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ status: 'under_review' })
    .eq('id', profileId)
    .eq('status', 'pending')

  if (error) throw new Error(error.message)

  revalidatePath('/approvals')
  revalidatePath('/superadmin/approvals')
  revalidatePath('/')
  return { success: true }
}

export async function rejectRegistration(profileId: string, reason: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  if (!reason || reason.trim() === '') {
    throw new Error('Rejection reason is required')
  }

  const activeMembershipId = await getActiveWorkspace()
  const profile = await getUserProfileWithMembership(session.user.id, activeMembershipId)
  if (!profile) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  if (!hasPermission(permissions, 'approve_registrations')) {
    throw new Error('Forbidden: Missing approve_registrations permission')
  }

  // Check branch scope
  if (!permissions.includes('*')) {
    const { data: mems } = await supabase.from('memberships').select('branch_id').eq('profile_id', profileId)
    const hasBranch = mems?.some(m => m.branch_id === profile.branch_id)
    if (!hasBranch) throw new Error('Forbidden: You can only manage members of your own branch.')
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      status: 'rejected',
      rejected_reason: reason.trim(),
      approved_by: session.user.id,
      approved_by_position: profile.position_name || (session.isSuperAdmin ? 'Superadmin' : 'Admin'),
      approved_at: new Date().toISOString(), // Track when it was rejected
    })
    .in('status', ['pending', 'under_review']) // Allow rejecting from pending or under_review
    .eq('id', profileId)
    .select('id, full_name')

  if (error) {
    throw new Error(error.message)
  }

  if (updated && updated.length > 0) {
    await notifyUser({
      profileId,
      event: 'registration.rejected',
      params: { reason: reason.trim() },
      actorProfileId: session.user.id,
    })
  }

  revalidatePath('/approvals')
  revalidatePath('/superadmin/approvals')
  revalidatePath('/')
  return { success: true }
}
