'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'

export async function createEvent(data: any) {
  const supabase = createAdminClient()
  const session = await auth()
  
  if (!session?.user?.id) throw new Error('Unauthorized')
    
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      ...data,
      creator_id: session.user.id,
      status: 'draft'
    })
    .select()
    .single()

  if (error) throw error
  revalidatePath('/events')
  return event
}

export async function updateEvent(id: string, data: any) {
  const supabase = createAdminClient()
  
  const { data: event, error } = await supabase
    .from('events')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return event
}

export async function deleteEvent(id: string) {
  const supabase = createAdminClient()
  
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath('/events')
}

export async function submitEvent(id: string) {
  const supabase = createAdminClient()
  
  const { data: event, error } = await supabase
    .from('events')
    .update({ status: 'pending_approval', submitted_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, branches(name)')
    .single()

  if (error) throw error
  
  // Find branch admins to notify
  const { data: admins } = await supabase
    .from('memberships')
    .select('profile_id')
    .eq('branch_id', event.branch_id)
    .in('portal_role', ['admin', 'super_admin'])
    .is('ended_at', null)

  if (admins && admins.length > 0) {
    const notifications = admins.map(admin => ({
      profile_id: admin.profile_id,
      title: 'Event Approval Request',
      message: `A new event "${event.name}" for ${event.branches?.name} is waiting for your approval.`,
      type: 'warning'
    }))
    await supabase.from('notifications').insert(notifications)
  }
  
  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return event
}

export async function approveEvent(id: string, comment?: string) {
  const supabase = createAdminClient()
  const session = await auth()
  
  const { data: event, error } = await supabase
    .from('events')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  
  if (session?.user?.id) {
    await supabase.from('event_approvals').insert({
      event_id: id,
      level: 1,
      approver_id: session.user.id,
      decision: 'approved',
      comment
    })
  }

  // Notify creator
  await supabase.from('notifications').insert({
    profile_id: event.creator_id,
    title: 'Event Approved',
    message: `Your event "${event.name}" has been approved and published.`,
    type: 'success'
  })

  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return event
}

export async function rejectEvent(id: string, comment?: string) {
  const supabase = createAdminClient()
  const session = await auth()
  
  const { data: event, error } = await supabase
    .from('events')
    .update({ status: 'rejected' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (session?.user?.id) {
    await supabase.from('event_approvals').insert({
      event_id: id,
      level: 1,
      approver_id: session.user.id,
      decision: 'rejected',
      comment
    })
  }

  // Notify creator
  await supabase.from('notifications').insert({
    profile_id: event.creator_id,
    title: 'Event Rejected',
    message: `Your event "${event.name}" was rejected.${comment ? ` Reason: ${comment}` : ''}`,
    type: 'error'
  })

  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return event
}

export async function assignOrganizer(eventId: string, profileId: string) {
  const supabase = createAdminClient()
  const session = await auth()
  
  const { data, error } = await supabase
    .from('event_organizers')
    .insert({
      event_id: eventId,
      profile_id: profileId,
      assigned_by: session?.user?.id
    })
    .select()
    .single()

  if (error) throw error
  revalidatePath(`/events/${eventId}`)
  return data
}

export async function completeEvent(id: string, postEventData?: any) {
  const supabase = createAdminClient()
  
  const { data: event, error } = await supabase
    .from('events')
    .update({ status: 'completed', ...postEventData })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return event
}

export async function getCompletedEvents() {
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'completed')
    .order('event_date', { ascending: false })

  if (error) throw error
  return data
}
