import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/server'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { getUserProfileWithMembership } from '@/lib/queries'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Edit, Image as ImageIcon, Send } from 'lucide-react'
import Link from 'next/link'
import { submitEvent } from '../actions'
import { SubmitButton } from './submit-button'
import { DeleteButton } from './delete-button'

export default async function EventManagementPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const supabase = createAdminClient()
  const actor = await getEffectiveActor()
  const profile = await getUserProfileWithMembership(actor.actingProfileId!)

  if (!profile || !profile.branch_id) {
    redirect('/login')
  }

  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id)
  const canManageEvents = hasPermission(permissions, 'manage_events')

  if (!canManageEvents) {
    redirect('/')
  }

  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, event_date, status, banner, event_types(name)')
    .eq('branch_id', profile.branch_id)
    .order('event_date', { ascending: false })

  if (error) {
    console.error('Error fetching events:', error)
  }

  const pendingEvents = events?.filter(e => e.status === 'pending_approval') || []
  const otherEvents = events?.filter(e => e.status !== 'pending_approval') || []

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Event Management</h1>
        <p className="text-muted-foreground">
          Manage events for {profile.branch_name}. Edit details or upload event images.
        </p>
      </div>

      {pendingEvents.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Pending Approval 
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30">
                {pendingEvents.length}
              </Badge>
            </CardTitle>
            <CardDescription>These events are waiting for approval before they go live.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">All Events</CardTitle>
          <CardDescription>View and manage your active and past events.</CardDescription>
        </CardHeader>
        <CardContent>
          {otherEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No other events found.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EventCard({ event }: { event: any }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-500',
    pending_approval: 'bg-amber-500/10 text-amber-500',
    published: 'bg-emerald-500/10 text-emerald-500',
    rejected: 'bg-red-500/10 text-red-500',
  }

  const isFree = event.banner?.is_free ?? true

  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-4 flex flex-col gap-4">
      <div>
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-semibold line-clamp-1">{event.name}</h3>
          <Badge variant="secondary" className={`text-[10px] uppercase shrink-0 ${statusColors[event.status] || ''}`}>
            {event.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <CalendarIcon className="w-3 h-3" />
          {new Date(event.event_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-[10px]">{event.event_types?.name}</Badge>
          <Badge variant="outline" className="text-[10px]">{isFree ? 'Free' : 'Paid'}</Badge>
        </div>
      </div>
      
      <div className="mt-auto flex items-center gap-2 pt-4 border-t border-border/50">
        <Link href={`/events/${event.id}/edit`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full flex items-center gap-2">
            <Edit className="w-3 h-3" /> Edit
          </Button>
        </Link>
        {(event.status === 'draft' || event.status === 'published' || event.status === 'rejected') && (
          <DeleteButton eventId={event.id} eventName={event.name} />
        )}
        {event.status === 'draft' && (
          <div className="flex-1">
            <SubmitButton eventId={event.id} />
          </div>
        )}
      </div>
    </div>
  )
}
