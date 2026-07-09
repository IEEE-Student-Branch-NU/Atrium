import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getNotifications } from '@/lib/queries'
import { NotificationsClient } from './client'

export const metadata = {
  title: 'Notifications | Atrium',
}

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const notifications = await getNotifications(session.user.id, 50)

  const isAdmin = session?.isSuperAdmin === true

  return <NotificationsClient notifications={notifications} isAdmin={isAdmin} />
}
