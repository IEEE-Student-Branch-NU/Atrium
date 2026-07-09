import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getMembersDirectory, getAllBranches } from '@/lib/queries'
import { MembersDirectoryClient } from './client'

export const metadata = {
  title: 'Members | Atrium',
}

export default async function MembersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [allMembers, branchesData] = await Promise.all([
    getMembersDirectory(),
    getAllBranches()
  ])

  // Exclude the logged-in user — no need to search for yourself
  const members = allMembers.filter(m => m.id !== session.user!.id)
  const branches = branchesData.map(b => b.name)

  return <MembersDirectoryClient members={members} branches={branches} />
}
