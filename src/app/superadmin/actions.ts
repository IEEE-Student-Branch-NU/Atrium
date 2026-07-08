'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { setImpersonation, clearImpersonation } from '@/utils/auth/impersonation'
import { logAdminAction } from '@/utils/auth/audit'

/**
 * Module-private guard: only a signed-in super admin may call the actions
 * below. Reused by later Phase-2 actions appended to this file.
 */
async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.isSuperAdmin || !session.user?.id) return null
  return session
}

export async function openWorkspace(membershipId: string) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }

  const supabase = createAdminClient()
  const { data: membership } = await supabase
    .from('memberships')
    .select('id, profile_id, branch_id, position_id, profiles(full_name), branches(name), positions(name)')
    .eq('id', membershipId)
    .is('ended_at', null)
    .single()
  if (!membership) return { error: 'Membership not found' }

  await setImpersonation(membershipId)
  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'workspace_opened',
    entityType: 'workspace',
    entityId: membershipId,
    branchId: membership.branch_id,
    summary: `Opened workspace of ${(membership.profiles as unknown as { full_name: string | null } | null)?.full_name ?? membership.profile_id}`,
    details: { membershipId, profileId: membership.profile_id },
  })
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function exitWorkspace() {
  await clearImpersonation()
  revalidatePath('/', 'layout')
  redirect('/superadmin')
}
