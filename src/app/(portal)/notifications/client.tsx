'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Notification } from '@/lib/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, Check, Clock, ExternalLink } from 'lucide-react'
import { markAsRead, markAllAsRead } from './actions'
import { cn } from '@/lib/utils'

export function NotificationsClient({ notifications }: { notifications: Notification[] }) {
  const [isPending, startTransition] = useTransition()
  const unreadCount = notifications.filter(n => !n.is_read).length

  function handleMarkAsRead(id: string) {
    startTransition(() => {
      markAsRead(id)
    })
  }

  function handleMarkAll() {
    startTransition(() => {
      markAllAsRead()
    })
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground">
            Stay updated on your account activity and requests.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleMarkAll}
            disabled={isPending}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="border-dashed bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">All caught up!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You have no notifications.
              </p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={cn(
                "transition-colors",
                !notification.is_read ? "bg-sidebar-primary/5 border-sidebar-primary/20" : "bg-card/50 border-border/50 opacity-70"
              )}
            >
              <CardContent className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {!notification.is_read && (
                      <span className="flex h-2 w-2 rounded-full bg-sidebar-primary shrink-0" />
                    )}
                    <h4 className={cn("text-base font-semibold", !notification.is_read ? "text-foreground" : "text-foreground/80")}>
                      {notification.title}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground/90 pl-4 sm:pl-0">
                    {notification.message}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-2 pl-4 sm:pl-0 text-xs text-muted-foreground/70">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(notification.created_at).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                    
                    {notification.link && (
                      <Link 
                        href={notification.link}
                        className="flex items-center gap-1 text-sidebar-primary hover:underline"
                        onClick={() => {
                          if (!notification.is_read) handleMarkAsRead(notification.id)
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Details
                      </Link>
                    )}
                  </div>
                </div>
                
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pl-4 sm:pl-0">
                  {!notification.is_read && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleMarkAsRead(notification.id)}
                      disabled={isPending}
                      className="text-xs h-8 text-muted-foreground hover:text-foreground"
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
