import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getAllNotifications } from '@/app/superadmin/queries'
import { NotificationsList } from './notifications-list'
import { SendBroadcastDialog } from '@/components/superadmin/send-broadcast-dialog'
import { createAdminClient } from '@/utils/supabase/server'

export const metadata = {
  title: 'Notification History | Superadmin',
}

export default async function NotificationsHistoryPage() {
  const session = await auth()
  if (!session?.isSuperAdmin) redirect('/login')

  const [notifications, branchesResult, positionsResult] = await Promise.all([
    getAllNotifications(200),
    createAdminClient().from('branches').select('id, name').order('name'),
    createAdminClient().from('positions').select('id, name, branch_id').order('name')
  ])

  const branches = branchesResult.data ?? []
  const positions = positionsResult.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification History</h2>
          <p className="text-muted-foreground">View and manage all broadcasts and notifications sent across the platform.</p>
        </div>
        <SendBroadcastDialog branches={branches} positions={positions} />
      </div>

      <NotificationsList notifications={notifications} branches={branches} positions={positions} />
    </div>
  )
}
