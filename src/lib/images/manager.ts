import { SupabaseClient } from '@supabase/supabase-js'
import { processImage, ProcessedImage } from './processor'
import { uploadToImageKit, deleteFromImageKit } from './imagekit'

export interface ImageKitBannerMetadata {
  url: string
  file_id: string
  width: number
  height: number
  format: string
}

/**
 * Replaces the cover image for an event.
 * Handles deleting the old image from ImageKit, uploading the new one, and updating the database.
 */
export async function replaceCoverImage(
  supabase: SupabaseClient,
  eventId: string,
  file: File
): Promise<ImageKitBannerMetadata> {
  // 1. Fetch current cover image to delete it later
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('banner')
    .eq('id', eventId)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch event: ${fetchError.message}`)
  }

  // 2. Validate and process the incoming image
  const processedImage = await processImage(file)

  // 3. Upload the new image to ImageKit
  const folder = `/events/${eventId}/cover`
  const uploadResult = await uploadToImageKit(folder, 'cover', processedImage.buffer)

  const newBanner: ImageKitBannerMetadata = {
    url: uploadResult.url,
    file_id: uploadResult.fileId,
    width: processedImage.width,
    height: processedImage.height,
    format: processedImage.format,
  }

  // 4. Update the database with the new banner metadata
  const { error: updateError } = await supabase
    .from('events')
    .update({ banner: newBanner })
    .eq('id', eventId)

  if (updateError) {
    // If DB update fails, we should ideally rollback the ImageKit upload,
    // but at worst we have an orphaned file. Let's try to delete it:
    await deleteFromImageKit(uploadResult.fileId).catch(() => {})
    throw new Error(`Failed to update event banner in database: ${updateError.message}`)
  }

  // 5. Delete the old image from ImageKit if it exists
  if (event?.banner && (event.banner as any).file_id) {
    const oldFileId = (event.banner as any).file_id
    try {
      await deleteFromImageKit(oldFileId)
    } catch (e) {
      console.warn(`Failed to delete old cover image (fileId: ${oldFileId}):`, e)
      // We don't throw here to avoid failing the upload operation just because cleanup failed
    }
  }

  return newBanner
}

/**
 * Uploads multiple images to the event's gallery.
 * Handles partial failures gracefully.
 */
export async function uploadGalleryImages(
  supabase: SupabaseClient,
  eventId: string,
  files: File[]
): Promise<{ successful: any[]; failed: { fileName: string; reason: string }[] }> {
  const successful: any[] = []
  const failed: { fileName: string; reason: string }[] = []

  const folder = `/events/${eventId}/gallery`

  // Process and upload concurrently
  const uploadPromises = files.map(async (file) => {
    try {
      const processedImage = await processImage(file)
      const uploadResult = await uploadToImageKit(folder, 'gallery', processedImage.buffer)

      // Add to successful DB insertions
      return {
        event_id: eventId,
        imagekit_url: uploadResult.url,
        imagekit_file_id: uploadResult.fileId,
      }
    } catch (error: any) {
      failed.push({
        fileName: file.name,
        reason: error.message,
      })
      return null
    }
  })

  const results = await Promise.all(uploadPromises)
  const dbRecordsToInsert = results.filter((r) => r !== null)

  if (dbRecordsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('event_gallery_images')
      .insert(dbRecordsToInsert)
      .select()

    if (error) {
      // DB insertion failed for bulk
      console.error('Gallery DB insert failed', error)
      failed.push({ fileName: 'Bulk Insert', reason: `Database error: ${error.message}` })
      
      // Cleanup ImageKit uploads that we just did
      for (const record of dbRecordsToInsert) {
        if (record?.imagekit_file_id) {
          await deleteFromImageKit(record.imagekit_file_id).catch(() => {})
        }
      }
    } else if (data) {
      successful.push(...data)
    }
  }

  return { successful, failed }
}

/**
 * Deletes a gallery image from ImageKit and the database.
 */
export async function deleteGalleryImage(
  supabase: SupabaseClient,
  imageId: string
): Promise<void> {
  // 1. Get the image file_id
  const { data: image, error: fetchError } = await supabase
    .from('event_gallery_images')
    .select('imagekit_file_id')
    .eq('id', imageId)
    .single()

  if (fetchError || !image) {
    throw new Error('Gallery image not found in database')
  }

  // 2. Delete from ImageKit
  await deleteFromImageKit(image.imagekit_file_id)

  // 3. Delete from DB
  const { error: deleteError } = await supabase
    .from('event_gallery_images')
    .delete()
    .eq('id', imageId)

  if (deleteError) {
    throw new Error(`Failed to delete gallery image from database: ${deleteError.message}`)
  }
}
