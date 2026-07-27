import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getUserProfileWithMembership } from '@/lib/queries'
import { getAnalyticsData } from './queries'
import { AnalyticsClient } from './client'

export const metadata = {
  title: 'Analytics | Atrium',
}

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const profile = await getUserProfileWithMembership(session.user.id)
  if (!profile) redirect('/login')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  // Guard
  if (!hasPermission(permissions, 'manage_members') && !hasPermission(permissions, 'approve_registrations')) {
    redirect('/')
  }

  // Fetch data
  const data = await getAnalyticsData()

  return <AnalyticsClient {...data} />
}
