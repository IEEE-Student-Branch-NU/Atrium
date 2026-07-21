import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/server'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { getUserProfileWithMembership } from '@/lib/queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarIcon, MapPin } from 'lucide-react'
import Link from 'next/link'

export default async function EventsPage() {
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

  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, event_date, status, location, banner, event_types(name)')
    .eq('branch_id', profile.branch_id)
    .eq('status', 'published')
    .order('event_date', { ascending: true })

  if (error) {
    console.error('Error fetching events:', error)
  }

  const upcomingEvents = events?.filter(e => new Date(e.event_date) >= new Date()) || []
  const pastEvents = events?.filter(e => new Date(e.event_date) < new Date()) || []

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground">
          Discover and explore upcoming events at {profile.branch_name}.
        </p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl">Upcoming Events</CardTitle>
          <CardDescription>Don't miss out on these scheduled events.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
              No upcoming events found. Check back later!
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map(event => (
                <PublicEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pastEvents.length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm opacity-80">
          <CardHeader>
            <CardTitle className="text-lg">Past Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pastEvents.map(event => (
                <PublicEventCard key={event.id} event={event} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PublicEventCard({ event }: { event: any }) {
  const isFree = event.banner?.is_free ?? true
  const bannerUrl = typeof event.banner === 'string' ? event.banner : event.banner?.url

  return (
    <div className="rounded-xl border border-border/50 bg-background/50 flex flex-col overflow-hidden group">
      {bannerUrl ? (
        <div className="w-full aspect-video bg-muted relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={bannerUrl} 
            alt={event.name} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="w-full aspect-video bg-muted/50 flex items-center justify-center">
          <CalendarIcon className="w-8 h-8 text-muted-foreground/30" />
        </div>
      )}
      
      <div className="p-4 flex flex-col flex-1 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <Badge variant="secondary" className="text-[10px] uppercase shrink-0 bg-primary/10 text-primary">
              {event.event_types?.name}
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">
              {isFree ? 'FREE' : 'PAID'}
            </span>
          </div>
          <h3 className="font-semibold line-clamp-2 leading-tight">{event.name}</h3>
        </div>
        
        <div className="space-y-1.5 mt-auto text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {new Date(event.event_date).toLocaleDateString('en-IN', { 
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
              })}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
        </div>

        <Link href={`/events/${event.id}`} className="mt-2 block">
          <Button className="w-full" variant="outline">View Details</Button>
        </Link>
      </div>
    </div>
  )
}
