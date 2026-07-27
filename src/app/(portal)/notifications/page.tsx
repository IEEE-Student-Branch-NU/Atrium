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

  // Combine personal and branch notifications for the legacy client UI
  const allNotifications = [...notifications, ...branchNotifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <NotificationsClient
      notifications={allNotifications}
      isAdmin={isAdmin}
    />
  )
}
