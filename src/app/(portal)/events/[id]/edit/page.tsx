import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/server'
import { getAllBranches, getAllEventTypes, getUserProfileWithMembership } from '@/lib/queries'
import { EditEventForm } from '@/components/events/edit-event-form'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getEffectiveActor } from '@/utils/auth/superadmin'

export default async function EditEventPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const supabase = createAdminClient()
  const actor = await getEffectiveActor()
  const profile = await getUserProfileWithMembership(actor.actingProfileId!)

  if (!profile) {
    redirect('/login')
  }

  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !event) {
    notFound()
  }

  // Check permissions: either manage_events or the creator of the event
  let permissions: string[] = []
  if (profile.branch_id) {
    permissions = await getUserPermissions(supabase, profile.id, profile.branch_id)
  }
  const canManageEvents = hasPermission(permissions, 'manage_events')
  
  if (!canManageEvents && event.creator_id !== profile.id) {
    redirect('/events/management')
  }

  const [branches, eventTypes] = await Promise.all([
    getAllBranches(),
    getAllEventTypes()
  ])

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Edit Event</h1>
        <p className="text-muted-foreground">
          Update the details for "{event.name}".
        </p>
      </div>

      <EditEventForm event={event} branches={branches} eventTypes={eventTypes} />
    </div>
  )
}
