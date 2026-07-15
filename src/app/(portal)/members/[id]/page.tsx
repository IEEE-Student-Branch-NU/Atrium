import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getFullUserProfile, getUserProfileWithMembership } from '@/lib/queries'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { MemberProfileView } from './client'

export const metadata = {
  title: 'Member Profile | Atrium',
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  // If they're trying to view themselves, redirect to their own profile
  if (id === session.user.id) {
    redirect('/profile')
  }

  const profile = await getFullUserProfile(id)

  if (!profile || profile.status !== 'approved') {
    notFound()
  }

  const currentUserProfile = await getUserProfileWithMembership(session.user.id)
  if (!currentUserProfile) redirect('/login')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, currentUserProfile.id, currentUserProfile.branch_id ?? '')

  let canViewPrivateDetails = false
  if (permissions.includes('*')) {
    canViewPrivateDetails = true
  } else if (hasPermission(permissions, 'manage_members') || hasPermission(permissions, 'approve_registrations')) {
    const { data: mems } = await supabase.from('memberships').select('branch_id').eq('profile_id', id)
    canViewPrivateDetails = mems?.some(m => m.branch_id === currentUserProfile.branch_id) ?? false
  }

  return <MemberProfileView profile={profile} canViewPrivateDetails={canViewPrivateDetails} />
}
