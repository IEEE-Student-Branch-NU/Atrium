import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getUserPermissions } from '@/utils/auth/permissions'
import { getUserProfileWithMembership, getAllUserMemberships, getUnreadNotifications } from '@/lib/queries'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { createAdminClient } from '@/utils/supabase/server'
import { Sidebar } from '@/components/portal/sidebar'
import { TopBar } from '@/components/portal/top-bar'
import { TooltipProvider } from '@/components/ui/tooltip'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Get the active workspace membership ID from cookie
  const activeWorkspaceId = await getActiveWorkspace()

  // Fetch profile + resolve the active workspace membership
  const profile = await getUserProfileWithMembership(session.user.id, activeWorkspaceId)

  if (!profile) {
    redirect('/login')
  }

  // Fetch ALL active memberships for the Role Switcher
  const memberships = await getAllUserMemberships(session.user.id)

  // Fetch permissions for the active workspace
  const supabase = createAdminClient()
  let permissions: string[] = []

  if (profile.branch_id) {
    permissions = await getUserPermissions(
      supabase,
      profile.id,
      profile.branch_id,
      profile.membership_id
    )
  }

  // Fetch unread notifications count
  const unreadNotifications = await getUnreadNotifications(session.user.id)

  const userInfo = {
    name: profile.full_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    position: profile.position_name,
    branch: profile.branch_name,
  }

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          user={userInfo}
          permissions={permissions}
          memberships={memberships}
          activeMembershipId={profile.membership_id}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            user={userInfo}
            unreadCount={unreadNotifications.length}
          />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
