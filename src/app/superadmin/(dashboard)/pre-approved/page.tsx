import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getPreApprovedMembers } from '@/lib/queries'
import { PreApprovedClient } from '@/app/(portal)/pre-approved/client'

export const metadata = {
  title: 'Pre-Approved Members | Atrium Superadmin',
}

export default async function SuperAdminPreApprovedPage() {
  const session = await auth()
  if (!session?.user?.id || !session.isSuperAdmin) redirect('/login')

  // Fetch data
  const members = await getPreApprovedMembers()

  return <PreApprovedClient members={members} />
}
