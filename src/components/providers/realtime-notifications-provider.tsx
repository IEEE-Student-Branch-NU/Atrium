'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

export function RealtimeNotificationsProvider({ 
  profileId, 
  supabaseToken, 
  children 
}: { 
  profileId: string
  supabaseToken: string
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    // Initialize the client with our custom JWT
    const supabase = createClient(supabaseToken)

    // Set up the Realtime subscription for notifications
    const channel = supabase
      .channel('realtime:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          // Since RLS is enforced, we will only receive notifications 
          // that match profile_id = auth.uid() OR type = 'broadcast'
        },
        (payload) => {
          console.log('New notification received:', payload)
          
          // Trigger a soft refresh of server components
          // This updates the top bar unread count and the notifications list 
          // without losing client-side state
          router.refresh()

          const notification = payload.new as any
          
          // Show a toast based on notification type
          if (notification.type === 'error') {
            toast.error(notification.title, { description: notification.message })
          } else if (notification.type === 'success') {
            toast.success(notification.title, { description: notification.message })
          } else if (notification.type === 'warning') {
            toast.warning(notification.title, { description: notification.message })
          } else {
            toast(notification.title, { description: notification.message })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to realtime notifications')
        }
      })

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [profileId, supabaseToken, router])

  return <>{children}</>
}
