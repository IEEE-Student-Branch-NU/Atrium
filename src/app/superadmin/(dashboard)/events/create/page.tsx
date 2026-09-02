import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getAllBranches, getAllEventTypes } from '@/lib/queries'
import { CreateEventForm } from '@/components/events/create-event-form'

export default async function SuperAdminCreateEventPage() {
  const session = await auth()
  
  // Only superadmins can access this globally unrestricted create page
  if (!session?.user?.id || !session.isSuperAdmin) {
    redirect('/login')
  }

  const [branches, eventTypes] = await Promise.all([
    getAllBranches(),
    getAllEventTypes()
  ])

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Create Global Event</h1>
        <p className="text-muted-foreground">
          As a Superadmin, you can create events for any branch without restriction.
        </p>
      </div>

      <CreateEventForm branches={branches} eventTypes={eventTypes} />
    </div>
  )
}
