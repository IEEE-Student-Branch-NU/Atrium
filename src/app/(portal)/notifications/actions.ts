'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'

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

  const supabase = createAdminClient()

  const title = formData.get('title') as string
  const message = formData.get('message') as string
  const link = formData.get('link') as string || null
  const type = (formData.get('type') as string) || 'broadcast'

  if (!title || !message) {
    return { error: 'Title and message are required.' }
  }

  // Get all profile IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')

  if (!profiles || profiles.length === 0) {
    return { error: 'No users found.' }
  }

  // Bulk insert notifications
  const notifications = profiles.map(p => ({
    profile_id: p.id,
    title,
    message,
    link,
    type,
    is_read: false
  }))

  const { error } = await supabase
    .from('notifications')
    .insert(notifications)

  if (error) {
    console.error('Failed to send broadcast:', error)
    return { error: 'Failed to send broadcast.' }
  }

  return { success: true }
}
