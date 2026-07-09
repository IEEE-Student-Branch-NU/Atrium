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

  const members = await getMembersDirectory()

  return <MembersDirectoryClient members={members} />
}
