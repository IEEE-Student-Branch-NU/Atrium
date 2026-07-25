import { createAdminClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PostEventGalleryUpload } from '@/components/events/post-event-gallery-upload'
import { completeEvent } from '../actions'
import { auth } from '@/auth'

interface EventPageProps {
  params: Promise<{ id: string }>
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  // Get user session
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Fetch event details
  const { data: event, error } = await supabase
    .from('events')
    .select('*, branches(name), event_types(name)')
    .eq('id', id)
    .single()

  if (error || !event) notFound()

  // Fetch gallery images
  const { data: galleryImages } = await supabase
    .from('event_gallery_images')
    .select('*')
    .eq('event_id', id)
    .order('uploaded_at', { ascending: false })

  // Check if current user is admin/superadmin for this branch
  const { data: membership } = await supabase
    .from('memberships')
    .select('portal_role')
    .eq('profile_id', session.user.id)
    .eq('branch_id', event.branch_id)
    .is('ended_at', null)
    .single()

  const isAdmin = membership?.portal_role === 'admin' || membership?.portal_role === 'super_admin'
  const isCreator = event.creator_id === session.user.id
  const canEdit = isAdmin || isCreator

  const eventDate = new Date(event.event_date)
  const isPastEvent = eventDate < new Date()
  const isCompleted = event.status === 'completed'

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <p className="text-muted-foreground mt-2">{event.branches?.name} • {event.event_types?.name}</p>
          <div className="mt-4 flex space-x-4 text-sm">
            <span>📅 {eventDate.toLocaleDateString()}</span>
            <span>📍 {event.location || 'TBA'}</span>
            <span className="capitalize">🏷️ Status: {event.status.replace('_', ' ')}</span>
          </div>
        </div>
        
        {canEdit && isPastEvent && !isCompleted && (
          <form action={async () => {
            'use server'
            await completeEvent(event.id)
          }}>
            <Button type="submit">Mark as Completed</Button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 prose dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{event.description}</p>
        </div>
        
        <div className="md:col-span-1">
          {event.banner?.url ? (
            <div className="aspect-[3/4] relative rounded-xl overflow-hidden border bg-muted/10 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={event.banner.url} 
                alt={`${event.name} poster`} 
                className="object-cover w-full h-full hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] relative rounded-xl border border-dashed bg-muted/30 flex flex-col items-center justify-center text-muted-foreground">
              <span className="text-sm">No Poster</span>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="border rounded-lg p-6 bg-card text-card-foreground">
          <h2 className="text-xl font-semibold mb-4">Event Organizers</h2>
          <p className="text-sm text-muted-foreground mb-4">Assign members to help organize this event.</p>
          <div className="text-sm border p-4 rounded-md">
            Assign Organizer component coming soon...
          </div>
        </div>
      )}

      {(isCompleted || isAdmin || isCreator) && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold border-b pb-2">Event Gallery</h2>
          
          {canEdit && (
            <PostEventGalleryUpload 
              eventId={event.id} 
              imagekitEndpoint={process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || ''} 
            />
          )}

          {galleryImages && galleryImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryImages.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={img.imagekit_url} 
                    alt="Event gallery image" 
                    className="object-cover w-full h-full"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No images uploaded yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
