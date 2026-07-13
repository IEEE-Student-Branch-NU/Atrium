'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getUserProfileWithMembership } from '@/lib/queries'
import { notifyUser } from '@/lib/notifications'

export async function approveRegistration(profileId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const profile = await getUserProfileWithMembership(session.user.id)
  if (!profile) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  if (!hasPermission(permissions, 'approve_registrations')) {
    throw new Error('Forbidden: Missing approve_registrations permission')
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      status: 'approved',
      approved_by: session.user.id,
      approved_at: new Date().toISOString(),
      rejected_reason: null, // Clear any past rejection
    })
    .eq('id', profileId)
    .eq('status', 'pending') // Double check it's still pending
    .select('id, full_name')

  if (error) {
    throw new Error(error.message)
  }

  // Only notify if a row actually transitioned from pending → approved.
  if (updated && updated.length > 0) {
    await notifyUser({
      profileId,
      event: 'registration.approved',
      params: { name: updated[0].full_name },
      actorProfileId: session.user.id,
    })
  }

  revalidatePath('/approvals')
  revalidatePath('/')
  return { success: true }
}

export async function rejectRegistration(profileId: string, reason: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  if (!reason || reason.trim() === '') {
    throw new Error('Rejection reason is required')
  }

  const profile = await getUserProfileWithMembership(session.user.id)
  if (!profile) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  if (!hasPermission(permissions, 'approve_registrations')) {
    throw new Error('Forbidden: Missing approve_registrations permission')
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      status: 'rejected',
      rejected_reason: reason.trim(),
    })
    .eq('id', profileId)
    .eq('status', 'pending')
    .select('id')

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
  revalidatePath('/')
  return { success: true }
}
