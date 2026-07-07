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
