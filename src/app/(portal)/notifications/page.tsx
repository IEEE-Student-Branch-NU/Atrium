import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getNotifications, getFullUserProfile } from '@/lib/queries'
import { NotificationsClient } from './client'

export const metadata = {
  title: 'Notifications | Atrium',
}

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [notifications, profile] = await Promise.all([
    getNotifications(session.user.id, 50),
    getFullUserProfile(session.user.id)
  ])
  
  const isAdmin = profile?.is_super_admin || false

  return <NotificationsClient notifications={notifications} isAdmin={isAdmin} />
}
