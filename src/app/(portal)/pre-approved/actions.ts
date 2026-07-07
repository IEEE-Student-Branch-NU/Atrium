'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getUserProfileWithMembership } from '@/lib/queries'

export async function addPreApprovedMember(ieeeId: string, name: string, email?: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const profile = await getUserProfileWithMembership(session.user.id)
  if (!profile) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  if (!hasPermission(permissions, 'approve_registrations')) {
    throw new Error('Forbidden: Missing approve_registrations permission')
  }

  // Validate input
  if (!ieeeId || ieeeId.trim() === '') throw new Error('IEEE Membership ID is required')
  if (!name || name.trim() === '') throw new Error('Name is required')

  const { error } = await supabase
    .from('pre_approved_members')
    .insert({
      ieee_membership_id: ieeeId.trim(),
      name: name.trim(),
      email: email ? email.trim() : null,
      added_by: session.user.id
    })

  if (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error('This IEEE Membership ID is already pre-approved.')
    }
    throw new Error(error.message)
  }

  revalidatePath('/pre-approved')
  return { success: true }
}

export async function removePreApprovedMember(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const profile = await getUserProfileWithMembership(session.user.id)
  if (!profile) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  if (!hasPermission(permissions, 'approve_registrations')) {
    throw new Error('Forbidden: Missing approve_registrations permission')
  }

  const { error } = await supabase
    .from('pre_approved_members')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/pre-approved')
  return { success: true }
}
