import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getUserProfileWithMembership, getPendingRegistrations, getApprovalHistory } from '@/lib/queries'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { ApprovalsClient } from './client'

export const metadata = {
  title: 'Approvals | Atrium',
}

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const activeMembershipId = await getActiveWorkspace()
  const profile = await getUserProfileWithMembership(session.user.id, activeMembershipId)
  if (!profile) redirect('/login')

  const supabase = createAdminClient()
  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id ?? '')
  
  // Guard
  if (!hasPermission(permissions, 'approve_registrations')) {
    redirect('/')
  }

  // If superadmin, fetch all. Otherwise, fetch only for MDO's branch
  const isSuperAdmin = permissions.includes('*')
  const targetBranchId = isSuperAdmin ? undefined : (profile.branch_id ?? undefined)

  // Fetch data
  const [pending, history] = await Promise.all([
    getPendingRegistrations(targetBranchId),
    getApprovalHistory(50, targetBranchId),
  ])

  return <ApprovalsClient pending={pending} history={history} />
}
