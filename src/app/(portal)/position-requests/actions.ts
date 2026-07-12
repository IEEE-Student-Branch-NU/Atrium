'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { getUserProfileWithMembership } from '@/lib/queries'
import { logAdminAction } from '@/utils/auth/audit'
import { notifyUser } from '@/lib/notifications'

export async function approvePositionRequest(requestId: string, adminComment?: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }

  const supabase = createAdminClient()

  // Verify admin permissions — skipped entirely for super admins, who are
  // identified via the `superadmins` table and may have no branch
  // membership at all. The decision below operates on the REQUEST's own
  // branch_id/position_id, not the admin's, so this is safe to bypass.
  let profile: Awaited<ReturnType<typeof getUserProfileWithMembership>> = null
  let permissions: string[] = []

  if (!session.isSuperAdmin) {
    const activeWorkspaceId = await getActiveWorkspace()
    profile = await getUserProfileWithMembership(session.user.id, activeWorkspaceId)

    if (!profile || !profile.branch_id) {
      throw new Error('Invalid workspace')
    }

    permissions = await getUserPermissions(supabase, profile.id, profile.branch_id, profile.membership_id)
    if (!hasPermission(permissions, 'manage_positions')) {
      throw new Error('Unauthorized to approve position requests')
    }
  }

  // Get the request details (with position/branch names for the notification)
  const { data: request } = await supabase
    .from('position_requests')
    .select('*, positions(name), branches(name)')
    .eq('id', requestId)
    .single()

  if (!request || !['pending', 'under_review'].includes(request.status)) {
    throw new Error('Invalid request or already processed')
  }

  const positionName = (request.positions as unknown as { name: string } | null)?.name ?? null
  const branchName = (request.branches as unknown as { name: string } | null)?.name ?? null

  // Cross-branch check: if not superadmin, the admin must be in the same branch as the request
  if (!session.isSuperAdmin && !permissions.includes('*') && request.branch_id !== profile!.branch_id) {
    throw new Error('Unauthorized: Request is for a different branch')
  }

  // Check if they already hold this position
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('profile_id', request.profile_id)
    .eq('branch_id', request.branch_id)
    .eq('position_id', request.position_id)
    .is('ended_at', null)
    .limit(1)

  if (existingMembership && existingMembership.length > 0) {
    // Just mark as approved if they already have it (edge case)
    await supabase.from('position_requests').update({
      status: 'approved',
      admin_comment: adminComment || 'User already holds this position.',
      decided_by: session.user.id,
      decided_at: new Date().toISOString(),
    }).eq('id', requestId)
    throw new Error('User already holds this position. Request closed.')
  }

  // Create the new membership
  const { error: membershipError } = await supabase.from('memberships').insert({
    profile_id: request.profile_id,
    branch_id: request.branch_id,
    position_id: request.position_id,
    assigned_by: session.user.id,
    reason: `Position requested. Admin comment: ${adminComment || 'Approved'}`,
  })

  if (membershipError) {
    console.error('Membership creation failed:', membershipError)
    throw new Error('Failed to create new membership.')
  }

  // Update request status
  await supabase.from('position_requests').update({
    status: 'approved',
    admin_comment: adminComment || null,
    decided_by: session.user.id,
    decided_at: new Date().toISOString(),
  }).eq('id', requestId)

  // Notify the requester (in-app + email)
  await notifyUser({
    profileId: request.profile_id,
    event: 'position_request.approved',
    params: { position: positionName, branch: branchName },
    actorProfileId: session.user.id,
    branchId: request.branch_id,
  })

  // Audit Log
  await supabase.from('membership_audit_log').insert({
    profile_id: request.profile_id,
    branch_id: request.branch_id,
    action: 'membership_assigned',
    changed_by: session.user.id,
    details: {
      position_id: request.position_id,
      source: 'position_request_approval',
    },
  })

  // Super-admin audit trail — additive only; does not affect branch-admin flow.
  if (session?.isSuperAdmin) {
    await logAdminAction({
      actorProfileId: session.user!.id,
      action: 'position_request_approved',
      entityType: 'membership',
      entityId: requestId,
      branchId: request.branch_id,
      summary: 'Decided a position request',
      details: null,
    })
  }

  revalidatePath('/position-requests')
  revalidatePath('/profile')
  return { success: true }
}


export async function rejectPositionRequest(requestId: string, reason: string) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }

  if (!reason || reason.trim() === '') {
    throw new Error('Rejection reason is required')
  }

  const supabase = createAdminClient()

  // Verify admin permissions — skipped entirely for super admins, who are
  // identified via the `superadmins` table and may have no branch
  // membership at all. The decision below operates on the REQUEST's own
  // branch_id/position_id, not the admin's, so this is safe to bypass.
  let profile: Awaited<ReturnType<typeof getUserProfileWithMembership>> = null
  let permissions: string[] = []

  if (!session.isSuperAdmin) {
    const activeWorkspaceId = await getActiveWorkspace()
    profile = await getUserProfileWithMembership(session.user.id, activeWorkspaceId)

    if (!profile || !profile.branch_id) {
      throw new Error('Invalid workspace')
    }

    permissions = await getUserPermissions(supabase, profile.id, profile.branch_id, profile.membership_id)
    if (!hasPermission(permissions, 'manage_positions')) {
      throw new Error('Unauthorized to reject position requests')
    }
  }

  // Get the request details (with position name for the notification)
  const { data: request } = await supabase
    .from('position_requests')
    .select('branch_id, profile_id, status, positions(name)')
    .eq('id', requestId)
    .single()

  if (!request || !['pending', 'under_review'].includes(request.status)) {
    throw new Error('Invalid request or already processed')
  }

  const positionName = (request.positions as unknown as { name: string } | null)?.name ?? null

  // Cross-branch check: if not superadmin, the admin must be in the same branch as the request
  if (!session.isSuperAdmin && !permissions.includes('*') && request.branch_id !== profile!.branch_id) {
    throw new Error('Unauthorized: Request is for a different branch')
  }

  // Update request status
  await supabase.from('position_requests').update({
    status: 'rejected',
    admin_comment: reason.trim(),
    decided_by: session.user.id,
    decided_at: new Date().toISOString(),
  }).eq('id', requestId)

  // Notify the requester (in-app + email)
  await notifyUser({
    profileId: request.profile_id,
    event: 'position_request.rejected',
    params: { position: positionName, reason: reason.trim() },
    actorProfileId: session.user.id,
    branchId: request.branch_id,
  })

  // Super-admin audit trail — additive only; does not affect branch-admin flow.
  if (session?.isSuperAdmin) {
    await logAdminAction({
      actorProfileId: session.user!.id,
      action: 'position_request_rejected',
      entityType: 'membership',
      entityId: requestId,
      branchId: request.branch_id,
      summary: 'Decided a position request',
      details: null,
    })
  }

  revalidatePath('/position-requests')
  revalidatePath('/profile')
  return { success: true }
}
