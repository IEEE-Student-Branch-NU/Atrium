import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getFullUserProfile, getUserPositionRequests, getAllBranches } from '@/lib/queries'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { ProfileClient } from './client'

export const metadata = {
  title: 'About Me | Atrium',
  description: 'Manage your profile and positions',
}

export default async function ProfilePage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  const [profile, myRequests, branches, activeWorkspaceId] = await Promise.all([
    getFullUserProfile(session.user.id),
    getUserPositionRequests(session.user.id),
    getAllBranches(),
    getActiveWorkspace(),
  ])

  if (!profile) {
    redirect('/login')
  }

  // If the user signed in with email/password, they can change it.
  // We can't know for sure here, but we can check if they have a password hash.
  // For safety, we'll allow the UI, and the server action will reject it if they're OAuth-only.
  const hasPasswordAuth = true // Can be refined if needed

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">About Me</h1>
        <p className="text-muted-foreground">
          Manage your personal information, view your position history, and request new roles.
        </p>
      </div>

      <ProfileClient
        profile={profile}
        myRequests={myRequests}
        branches={branches}
        activeMembershipId={activeWorkspaceId}
      />
    </div>
  )
}
