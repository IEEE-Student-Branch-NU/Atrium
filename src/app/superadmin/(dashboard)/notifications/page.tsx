import { requireSuperAdmin } from '@/utils/auth/superadmin'
import { redirect } from 'next/navigation'
import { getAllNotifications } from '@/app/superadmin/queries'
import { NotificationsList } from './notifications-list'

export const metadata = {
  title: 'Notification History | Superadmin',
}

export default async function AdminNotificationsPage() {
  const session = await requireSuperAdmin()
  if (!session) redirect('/superadmin/login')

  const notifications = await getAllNotifications(200)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notification History</h1>
        <p className="text-muted-foreground mt-2">
          View recent notifications and broadcasts sent across the platform.
        </p>
      </div>

      <NotificationsList notifications={notifications} />
    </div>
  )
}
