import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getUserProfileWithMembership, getPreApprovedMembers } from '@/lib/queries'
import { PreApprovedClient } from './client'

export const metadata = {
  title: 'Pre-Approved Members | Atrium',
}

export default async function PreApprovedPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const profile = await getUserProfileWithMembership(session.user.id)
  if (!profile) redirect('/login')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  // Guard
  if (!hasPermission(permissions, 'approve_registrations')) {
    redirect('/')
  }

  // Fetch data
  const members = await getPreApprovedMembers()

  return <PreApprovedClient members={members} />
}
