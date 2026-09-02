import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { SuperadminEventsClient } from './client'

export const metadata = {
  title: 'Events | Atrium Superadmin',
}

export const dynamic = 'force-dynamic'

export default async function SuperAdminEventsPage() {
  const session = await auth()
  if (!session?.user?.id || !session.isSuperAdmin) redirect('/login')

  const supabase = createAdminClient()

  // Fetch all events globally
  const { data: events, error } = await supabase
    .from('events')
    .select('*, branches(name), profiles:creator_id(full_name, email)')
    .order('event_date', { ascending: false })

  if (error) {
    console.error('Failed to fetch events for superadmin:', error)
  }

  return <SuperadminEventsClient events={events || []} />
}
