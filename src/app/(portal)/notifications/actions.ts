'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { notifyBroadcast, type NotificationSeverity } from '@/lib/notifications'

export async function markAsRead(notificationId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  const supabase = createAdminClient()
  
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('profile_id', session.user.id)

  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function markAllAsRead() {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  const supabase = createAdminClient()
  
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', session.user.id)
    .eq('is_read', false)

  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function sendBroadcast(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  // Verify admin status
  const canBroadcast = session?.isSuperAdmin === true
  if (!canBroadcast) return { error: 'Unauthorized. Only admins can send broadcasts.' }

  const title = (formData.get('title') as string)?.trim()
  const message = (formData.get('message') as string)?.trim()
  const link = (formData.get('link') as string) || null
  const rawType = (formData.get('type') as string) || 'info'
  // Legacy 'broadcast' style value maps to the neutral 'info' severity.
  const type = (['normal', 'info', 'success', 'warning', 'error'].includes(rawType)
    ? rawType
    : 'info') as NotificationSeverity

  if (!title || !message) {
    return { error: 'Title and message are required.' }
  }

  // Single broadcast row; fanned out to every user via RLS + realtime.
  await notifyBroadcast({ title, message, type, link, actorProfileId: session.user.id })

  revalidatePath('/notifications')
  return { success: true }
}
