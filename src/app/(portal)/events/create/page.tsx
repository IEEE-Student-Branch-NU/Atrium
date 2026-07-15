import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/server'
import { getAllBranches, getAllEventTypes, getUserProfileWithMembership } from '@/lib/queries'
import { CreateEventForm } from '@/components/events/create-event-form'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getEffectiveActor } from '@/utils/auth/superadmin'

export default async function CreateEventPage() {
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

  // Check if user has permission to create events
  let permissions: string[] = []
  if (profile.branch_id) {
    permissions = await getUserPermissions(supabase, profile.id, profile.branch_id)
  }
  const canCreateEvents = hasPermission(permissions, 'create_events')

  if (!canCreateEvents) {
    notFound() // or redirect to an unauthorized page
  }

  const [branches, eventTypes] = await Promise.all([
    getAllBranches(),
    getAllEventTypes()
  ])

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Create Event</h1>
        <p className="text-muted-foreground">
          Draft a new event for your branch. You can publish it later.
        </p>
      </div>

      <CreateEventForm branches={branches} eventTypes={eventTypes} />
    </div>
  )
}
