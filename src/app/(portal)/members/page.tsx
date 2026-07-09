import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getMembersDirectory } from '@/lib/queries'
import { MembersDirectoryClient } from './client'

export const metadata = {
  title: 'Members | Atrium',
}

export default async function MembersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const allMembers = await getMembersDirectory()

  // Exclude the logged-in user — no need to search for yourself
  const members = allMembers.filter(m => m.id !== session.user!.id)

  return <MembersDirectoryClient members={members} />
}
