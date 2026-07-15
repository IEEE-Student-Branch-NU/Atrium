'use server'

import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getUserProfileWithMembership } from '@/lib/queries'
import { revalidatePath } from 'next/cache'

export async function updateMembershipExpiry(profileId: string, expiryDate: string | null) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const profile = await getUserProfileWithMembership(session.user.id)
  if (!profile) throw new Error('Unauthorized')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  if (!hasPermission(permissions, 'manage_members') && !hasPermission(permissions, 'approve_registrations')) {
    throw new Error('Forbidden: Missing manage_members or approve_registrations permission')
  }

  // Check branch scope
  if (!permissions.includes('*')) {
    const { data: mems } = await supabase.from('memberships').select('branch_id').eq('profile_id', profileId)
    const hasBranch = mems?.some(m => m.branch_id === profile.branch_id)
    if (!hasBranch) throw new Error('Forbidden: You can only edit members of your own branch.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      membership_expiry: expiryDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', profileId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/members')
  return { success: true }
}
