import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { getNotifications, getBranchNotifications, getUserProfileWithMembership } from '@/lib/queries'
import { isChairPosition } from '@/lib/notifications'
import { NotificationsClient } from './client'

export const metadata = {
  title: 'Notifications | Atrium',
}

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Resolve the active workspace the same way the portal layout does, so the
  // Chair "Branch activity" tab keys off the workspace the member is acting in.
  const actor = await getEffectiveActor()
  const activeWorkspaceId = actor.isImpersonating
    ? actor.actingMembershipId
    : await getActiveWorkspace()
  const profile = await getUserProfileWithMembership(actor.actingProfileId ?? session.user.id, activeWorkspaceId)

  const isChair = isChairPosition(profile?.position_name)
  const branchId = profile?.branch_id ?? null

  const [notifications, branchNotifications] = await Promise.all([
    getNotifications(actor.actingProfileId ?? session.user.id, 50),
    isChair && branchId ? getBranchNotifications(branchId, 50) : Promise.resolve([]),
  ])

  const isAdmin = session?.isSuperAdmin === true

  return (
    <NotificationsClient
      notifications={notifications}
      branchNotifications={branchNotifications}
      isChair={isChair}
      branchName={profile?.branch_name ?? null}
      isAdmin={isAdmin}
    />
  )
}
