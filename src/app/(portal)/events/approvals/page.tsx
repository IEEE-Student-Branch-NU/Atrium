import { createAdminClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { getUserProfileWithMembership } from '@/lib/queries'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { ApprovalsClient } from './client'

export default async function EventApprovalsPage() {
  const supabase = createAdminClient()

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const actor = await getEffectiveActor()
  const activeWorkspaceId = actor.isImpersonating
    ? actor.actingMembershipId
    : await getActiveWorkspace()

  const profile = await getUserProfileWithMembership(actor.actingProfileId!, activeWorkspaceId)

  if (!profile || !profile.branch_id) {
    redirect('/login')
  }

  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id, profile.membership_id)
  const canApproveEvents = hasPermission(permissions, 'approve_events')

  if (!canApproveEvents) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">Unauthorized</h1>
        <p className="text-muted-foreground mt-2">You do not have permission to view event approvals.</p>
      </div>
    )
  }

  // Fetch pending events for the current branch
  const { data: pendingEvents, error } = await supabase
    .from('events')
    .select('*, branches(name), profiles:creator_id(full_name, email)')
    .eq('status', 'pending_approval')
    .eq('branch_id', profile.branch_id)
    .order('submitted_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch pending events:', error)
  }

  return (
    <ApprovalsClient 
      pendingEvents={pendingEvents || []} 
      currentUserId={session.user.id} 
    />
  )
}
