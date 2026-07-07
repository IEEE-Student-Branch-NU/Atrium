'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { setActiveWorkspace } from '@/utils/auth/workspace'
import { createAdminClient } from '@/utils/supabase/server'

/**
 * Switch the active workspace to a different membership.
 * Validates that the membership belongs to the current user and is still active.
 */
export async function switchWorkspace(membershipId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    return { error: 'Not authenticated' }
  }

  const supabase = createAdminClient()

  // Validate: the membership must belong to this user and be active
  const { data: membership } = await supabase
    .from('memberships')
    .select('id, branch_id, position_id, branches(name), positions(name)')
    .eq('id', membershipId)
    .eq('profile_id', session.user.id)
    .is('ended_at', null)
    .single()

  if (!membership) {
    return { error: 'Invalid workspace' }
  }

  // Set the cookie
  await setActiveWorkspace(membershipId)

  // Log the workspace switch in audit
  await supabase.from('membership_audit_log').insert({
    profile_id: session.user.id,
    branch_id: membership.branch_id,
    action: 'workspace_switched',
    changed_by: session.user.id,
    details: {
      membership_id: membershipId,
      position: (membership.positions as any)?.name,
      branch: (membership.branches as any)?.name,
    },
  })

  // Revalidate the entire portal layout
  revalidatePath('/', 'layout')

  return { success: true }
}
