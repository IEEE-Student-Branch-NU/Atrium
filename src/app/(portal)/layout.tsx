import { redirect } from 'next/navigation'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { getUserPermissions } from '@/utils/auth/permissions'
import { getUserProfileWithMembership, getAllUserMemberships, getUnreadNotifications } from '@/lib/queries'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { createAdminClient } from '@/utils/supabase/server'
import { Sidebar } from '@/components/portal/sidebar'
import { TopBar } from '@/components/portal/top-bar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ImpersonationBanner } from '@/components/superadmin/impersonation-banner'
import { createSupabaseToken } from '@/utils/supabase/token'
import { RealtimeNotificationsProvider } from '@/components/providers/realtime-notifications-provider'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = await getEffectiveActor()

  if (!actor.realProfileId) {
    redirect('/login')
  }

  // While impersonating, the active workspace is the target membership being
  // viewed, not whatever workspace cookie the real (super admin) user has.
  const activeWorkspaceId = actor.isImpersonating
    ? actor.actingMembershipId
    : await getActiveWorkspace()

  // These three reads are independent (all keyed off the acting profile) —
  // run them concurrently instead of one-after-another. They run on every
  // portal page, so this trims real latency off every navigation.
  const [profile, memberships, unreadNotifications] = await Promise.all([
    getUserProfileWithMembership(actor.actingProfileId!, activeWorkspaceId),
    getAllUserMemberships(actor.actingProfileId!),
    getUnreadNotifications(actor.actingProfileId!),
  ])

  if (!profile) {
    redirect('/login')
  }

  // Fetch permissions for the active workspace (needs the resolved profile).
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

  // Mint a custom Supabase JWT for the client to use with Realtime (CPU-only
  // signing, not a DB round-trip — cheap to leave here).
  const supabaseToken = await createSupabaseToken(actor.actingProfileId!)

  const userInfo = {
    name: profile.full_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    position: profile.position_name,
    branch: profile.branch_name,
  }

  return (
    <TooltipProvider delay={0}>
      <RealtimeNotificationsProvider 
        profileId={actor.actingProfileId!} 
        supabaseToken={supabaseToken}
      >
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar
            user={userInfo}
            permissions={permissions}
            memberships={memberships}
            activeMembershipId={profile.membership_id}
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            {actor.isImpersonating && <ImpersonationBanner name={profile.full_name ?? 'this member'} />}
            <TopBar
              user={userInfo}
              unreadCount={unreadNotifications.length}
            />
            <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 lg:p-8 md:pb-6 lg:pb-8">
              {children}
            </main>
          </div>
        </div>
      </RealtimeNotificationsProvider>
    </TooltipProvider>
  )
}
