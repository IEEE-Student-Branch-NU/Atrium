'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { replaceCoverImage, uploadGalleryImages, deleteGalleryImage } from '@/lib/images/manager'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'

// Authentication and Authorization check for events
async function checkEventManagementPermission(supabase: any, eventId: string) {
  const actor = await getEffectiveActor()
  if (!actor.actingProfileId) {
    throw new Error('Unauthorized')
  }

  const { data: event } = await supabase
    .from('events')
    .select('branch_id, creator_id')
    .eq('id', eventId)
    .single()

  if (!event) {
    throw new Error('Event not found')
  }

  // Allow if user is the creator
  if (event.creator_id === actor.actingProfileId) {
    return
  }

  // Check branch-level permission
  const permissions = await getUserPermissions(supabase, actor.actingProfileId, event.branch_id)
  if (!hasPermission(permissions, 'manage_events')) {
    throw new Error('Forbidden: You do not have permission to manage this event.')
  }
}

export async function uploadEventCoverAction(eventId: string, formData: FormData) {
  try {
    const supabase = createAdminClient()
    await checkEventManagementPermission(supabase, eventId)

    const file = formData.get('coverImage') as File
    if (!file) throw new Error('No file provided')

    const banner = await replaceCoverImage(supabase, eventId, file)
    return { success: true, banner }
  } catch (error: any) {
    console.error('uploadEventCoverAction error:', error)
    return { success: false, error: error.message }
  }
}

export async function uploadEventGalleryAction(eventId: string, formData: FormData) {
  try {
    const supabase = createAdminClient()
    await checkEventManagementPermission(supabase, eventId)

    const files = formData.getAll('galleryImages') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    const result = await uploadGalleryImages(supabase, eventId, files)
    return { success: true, result }
  } catch (error: any) {
    console.error('uploadEventGalleryAction error:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteEventGalleryImageAction(eventId: string, imageId: string) {
  try {
    const supabase = createAdminClient()
    await checkEventManagementPermission(supabase, eventId)

    await deleteGalleryImage(supabase, imageId)
    return { success: true }
  } catch (error: any) {
    console.error('deleteEventGalleryImageAction error:', error)
    return { success: false, error: error.message }
  }
}
