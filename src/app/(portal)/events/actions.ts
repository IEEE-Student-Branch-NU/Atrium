'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/utils/auth/audit'
import { auth } from '@/auth'
import { processImage } from '@/lib/images/processor'
import { uploadToImageKit, deleteFromImageKit } from '@/lib/images/imagekit'

export async function createEvent(data: any) {
  const supabase = createAdminClient()
  const session = await auth()
  
  if (!session?.user?.id) throw new Error('Unauthorized')
    
  const { end_date, is_free, registration_url, banner, banner_file, ...rest } = data

  const initialBanner = banner 
    ? (typeof banner === 'string' ? { url: banner, end_date, is_free, registration_url } : { ...banner, end_date, is_free, registration_url }) 
    : { end_date, is_free, registration_url }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      ...rest,
      banner: initialBanner,
      creator_id: session.user.id,
      status: 'draft'
    })
    .select()
    .single()

  if (error) throw error

  if (banner_file) {
    try {
      const processed = await processImage(banner_file)
      const folder = `/events/${event.id}/cover`
      const uploadResult = await uploadToImageKit(folder, 'cover', processed.buffer)
      const newBanner = { 
        ...event.banner, 
        url: uploadResult.url, 
        file_id: uploadResult.fileId, 
        width: processed.width, 
        height: processed.height, 
        format: processed.format 
      }
      await supabase.from('events').update({ banner: newBanner }).eq('id', event.id)
    } catch (e) {
      console.error('Failed to upload banner:', e)
    }
  }

  await logAdminAction({
    actorProfileId: session.user.id,
    action: 'event_drafted',
    entityType: 'event',
    entityId: event.id,
    branchId: event.branch_id,
    summary: `Drafted event "${event.name}"`
  })

  revalidatePath('/events')
  return event
}

export async function updateEvent(id: string, data: any) {
  const supabase = createAdminClient()
  const session = await auth()
  
  const { end_date, is_free, registration_url, banner, banner_file, ...rest } = data

  let updatePayload = { ...rest }
  const { data: existingEvent } = await supabase.from('events').select('banner').eq('id', id).single()
  const existingBanner = existingEvent?.banner || {}

  if (end_date !== undefined || is_free !== undefined || registration_url !== undefined) {
    const newBanner = banner !== undefined 
      ? (typeof banner === 'string' ? { url: banner, end_date, is_free, registration_url } : { ...banner, end_date, is_free, registration_url })
      : { ...existingBanner, end_date, is_free, registration_url }
    
    // clean up undefined
    if (end_date === undefined) delete newBanner.end_date
    if (is_free === undefined) delete newBanner.is_free
    if (registration_url === undefined) delete newBanner.registration_url

    updatePayload.banner = newBanner
  } else if (banner !== undefined) {
    updatePayload.banner = banner
  }

  if (banner_file) {
    try {
      const processed = await processImage(banner_file)
      const folder = `/events/${id}/cover`
      const uploadResult = await uploadToImageKit(folder, 'cover', processed.buffer)
      updatePayload.banner = { 
        ...(updatePayload.banner || existingBanner), 
        url: uploadResult.url, 
        file_id: uploadResult.fileId, 
        width: processed.width, 
        height: processed.height, 
        format: processed.format 
      }
      
      // Delete old image if exists
      if (existingBanner.file_id) {
        await deleteFromImageKit(existingBanner.file_id).catch(() => {})
      }
    } catch (e) {
      console.error('Failed to upload new banner:', e)
    }
  }

  const { data: event, error } = await supabase
    .from('events')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  
  if (session?.user?.id) {
    await logAdminAction({
      actorProfileId: session.user.id,
      action: 'edited',
      entityType: 'event',
      entityId: event.id,
      branchId: event.branch_id,
      summary: `Updated event "${event.name}"`
    })
  }

  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return event
}

export async function deleteEvent(id: string) {
  const supabase = createAdminClient()
  const session = await auth()
  
  const { data: event, error: fetchError } = await supabase.from('events').select('branch_id, name').eq('id', id).single()
  
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) throw error

  if (session?.user?.id && !fetchError && event) {
    await logAdminAction({
      actorProfileId: session.user.id,
      action: 'deleted',
      entityType: 'event',
      entityId: id,
      branchId: event.branch_id,
      summary: `Deleted event "${event.name}"`
    })
  }

  revalidatePath('/events')
}

export async function submitEvent(id: string) {
  const supabase = createAdminClient()
  const session = await auth()
  
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
  
  if (session?.user?.id) {
    await logAdminAction({
      actorProfileId: session.user.id,
      action: 'submitted',
      entityType: 'event',
      entityId: event.id,
      branchId: event.branch_id,
      summary: `Submitted event "${event.name}" for approval`
    })
  }
  
  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return event
}

export async function approveEvent(id: string, comment?: string) {
  const supabase = createAdminClient()
  const session = await auth()
  
  // Fetch event first to check creator
  const { data: existingEvent, error: fetchError } = await supabase
    .from('events')
    .select('creator_id')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  if (session?.user?.id && existingEvent.creator_id === session.user.id) {
    throw new Error('You cannot approve your own event.')
  }

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
    
    await logAdminAction({
      actorProfileId: session.user.id,
      action: 'event_permitted',
      entityType: 'event',
      entityId: event.id,
      branchId: event.branch_id,
      summary: `Approved event "${event.name}"`
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
  
  // Fetch event first to check creator
  const { data: existingEvent, error: fetchError } = await supabase
    .from('events')
    .select('creator_id')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  if (session?.user?.id && existingEvent.creator_id === session.user.id) {
    throw new Error('You cannot reject your own event.')
  }

  // Send back to draft so creator can revise and resubmit
  const { data: event, error } = await supabase
    .from('events')
    .update({ status: 'draft' })
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

    await logAdminAction({
      actorProfileId: session.user.id,
      action: 'rejected',
      entityType: 'event',
      entityId: event.id,
      branchId: event.branch_id,
      summary: `Sent event "${event.name}" back to draft${comment ? `: ${comment}` : ''}`
    })
  }

  // Notify creator with notes
  await supabase.from('notifications').insert({
    profile_id: event.creator_id,
    title: 'Event Sent Back for Revision',
    message: `Your event "${event.name}" needs changes before it can be approved.${comment ? ` Notes: ${comment}` : ''}`,
    type: 'warning'
  })

  revalidatePath('/events')
  revalidatePath(`/events/${id}`)
  return event
}

export async function publishEvent(id: string) {
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
    await logAdminAction({
      actorProfileId: session.user.id,
      action: 'published',
      entityType: 'event',
      entityId: event.id,
      branchId: event.branch_id,
      summary: `Published event "${event.name}"`
    })
  }

  // Notify creator
  await supabase.from('notifications').insert({
    profile_id: event.creator_id,
    title: 'Event Published',
    message: `Your event "${event.name}" is now live and visible to everyone!`,
    type: 'success'
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
