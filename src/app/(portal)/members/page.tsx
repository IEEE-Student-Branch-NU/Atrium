import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getMembersDirectory, getAllBranches, getUserProfileWithMembership } from '@/lib/queries'
import { MembersDirectoryClient } from './client'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { createAdminClient } from '@/utils/supabase/server'
import { checkPermission } from '@/utils/auth/permissions'

export const metadata = {
  title: 'Members | Atrium',
}

export default async function MembersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const actor = await getEffectiveActor()
  if (!actor.realProfileId) {
    redirect('/login')
  }

  const activeWorkspaceId = actor.isImpersonating
    ? actor.actingMembershipId
    : await getActiveWorkspace()

  const [allMembers, branchesData, profile] = await Promise.all([
    getMembersDirectory(),
    getAllBranches(),
    getUserProfileWithMembership(actor.actingProfileId!, activeWorkspaceId)
  ])

  // Exclude the logged-in user — no need to search for yourself
  const members = allMembers.filter(m => m.id !== session.user!.id)
  const branches = branchesData.map(b => b.name)
  let canManageMembers = false
  if (profile?.branch_id) {
    const supabase = createAdminClient()
    canManageMembers = await checkPermission(
      supabase,
      actor.actingProfileId!,
      profile.branch_id,
      'manage_members',
      activeWorkspaceId
    )
  }

  return <MembersDirectoryClient members={members} branches={branches} canManageMembers={canManageMembers} />
}
