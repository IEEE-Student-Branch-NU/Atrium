import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getFullUserProfile } from '@/lib/queries'
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

  return <MemberProfileView profile={profile} />
}
