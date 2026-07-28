import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getPendingRegistrations, getApprovalHistory } from '@/lib/queries'
import { ApprovalsClient } from '@/app/(portal)/approvals/client'

export const metadata = {
  title: 'Approvals | Atrium Superadmin',
}

export const dynamic = 'force-dynamic'

export default async function SuperAdminApprovalsPage() {
  const session = await auth()
  if (!session?.user?.id || !session.isSuperAdmin) redirect('/login')

  // Superadmin fetches all branches
  const targetBranchId = undefined

  // Fetch data
  const [pending, history] = await Promise.all([
    getPendingRegistrations(targetBranchId),
    getApprovalHistory(50, targetBranchId),
  ])

  return <ApprovalsClient pending={pending} history={history} />
}
