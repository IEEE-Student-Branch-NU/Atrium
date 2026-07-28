import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getAnalyticsData } from '@/app/(portal)/analytics/queries'
import { AnalyticsClient } from '@/app/(portal)/analytics/client'

export const metadata = {
  title: 'Analytics | Atrium Superadmin',
}

export default async function SuperAdminAnalyticsPage() {
  const session = await auth()
  if (!session?.user?.id || !session.isSuperAdmin) redirect('/login')

  // Fetch data
  const data = await getAnalyticsData()

  return <AnalyticsClient {...data} />
}
