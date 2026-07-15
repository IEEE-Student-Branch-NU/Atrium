import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { approveEvent, rejectEvent } from '../actions'
import Link from 'next/link'

export default async function EventApprovalsPage() {
  const supabase = createClient()

  // Get user session
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) redirect('/login')

  // Get user's memberships to check admin roles
  const { data: memberships } = await supabase
    .from('memberships')
    .select('branch_id, portal_role, branches(name)')
    .eq('profile_id', userData.user.id)
    .is('ended_at', null)

  const adminMemberships = memberships?.filter(
    (m) => m.portal_role === 'admin' || m.portal_role === 'super_admin'
  ) || []

  if (adminMemberships.length === 0) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">Unauthorized</h1>
        <p className="text-muted-foreground mt-2">You do not have permission to view event approvals.</p>
      </div>
    )
  }

  const isSuperAdmin = adminMemberships.some(m => m.portal_role === 'super_admin')
  const branchIds = adminMemberships.map(m => m.branch_id)

  // Fetch pending events
  let query = supabase
    .from('events')
    .select('*, branches(name), profiles:creator_id(full_name, email)')
    .eq('status', 'pending_approval')
    .order('submitted_at', { ascending: true })

  if (!isSuperAdmin) {
    query = query.in('branch_id', branchIds)
  }

  const { data: pendingEvents, error } = await query

  if (error) {
    console.error('Failed to fetch pending events:', error)
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Event Approvals</h1>
      
      {pendingEvents && pendingEvents.length > 0 ? (
        <div className="space-y-4">
          {pendingEvents.map((event) => (
            <div key={event.id} className="border rounded-lg p-6 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <Link href={`/events/${event.id}`} className="hover:underline">
                  <h3 className="text-xl font-semibold">{event.name}</h3>
                </Link>
                <div className="text-sm text-muted-foreground mt-1 space-y-1">
                  <p>Branch: <span className="font-medium text-foreground">{event.branches?.name}</span></p>
                  <p>Created by: <span className="font-medium text-foreground">{event.profiles?.full_name || event.profiles?.email}</span></p>
                  <p>Date: {new Date(event.event_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex gap-2 shrink-0">
                <form action={async () => {
                  'use server'
                  await approveEvent(event.id)
                }}>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
                </form>
                
                <form action={async () => {
                  'use server'
                  await rejectEvent(event.id)
                }}>
                  <Button type="submit" variant="destructive">Reject</Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">No events pending approval in your branches.</p>
        </div>
      )}
    </div>
  )
}
