import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { 
  getUserProfileWithMembership, 
  getPendingPositionRequests, 
  getCancelledPositionRequests, 
  getDecidedPositionRequests 
} from '@/lib/queries'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { PositionRequestsClient } from './client'

export const metadata = {
  title: 'Position Requests | Atrium',
}

export default async function PositionRequestsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const actor = await getEffectiveActor()
  const activeWorkspaceId = actor.isImpersonating
    ? actor.actingMembershipId
    : await getActiveWorkspace()
  const profile = await getUserProfileWithMembership(actor.actingProfileId!, activeWorkspaceId)
  if (!profile || !profile.branch_id) redirect('/login')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id, profile.membership_id)
  
  // Guard
  if (!hasPermission(permissions, 'manage_positions')) {
    redirect('/')
  }

  // Fetch requests. 
  // Ideally, this should be filtered by branch if the user is not superadmin.
  let [pending, cancelled, decided] = await Promise.all([
    getPendingPositionRequests(),
    getCancelledPositionRequests(),
    getDecidedPositionRequests()
  ])

  // Filter if not superadmin (or wildcard perms)
  if (!permissions.includes('*')) {
    pending = pending.filter(req => req.branch_name === profile.branch_name)
    cancelled = cancelled.filter(req => req.branch_name === profile.branch_name)
    decided = decided.filter(req => req.branch_name === profile.branch_name)
  }

  return (
    <PositionRequestsClient 
      requests={pending} 
      cancelledRequests={cancelled} 
      decidedRequests={decided} 
    />
  )
}
