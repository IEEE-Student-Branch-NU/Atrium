'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Notification } from '@/lib/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, Check, Clock, ExternalLink, Send, Info, AlertTriangle, CheckCircle, XCircle, Megaphone, Building2 } from 'lucide-react'
import { markAsRead, markAllAsRead, sendBroadcast } from './actions'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Style is chosen by audience first (broadcast / branch have their own look),
// then by severity `type`.
function getNotificationStyle(notification: Notification) {
  const isRead = notification.is_read
  if (notification.audience === 'broadcast' || notification.type === 'broadcast') {
    return {
      icon: Megaphone,
      colorClass: isRead ? 'text-purple-500/60' : 'text-purple-500',
      bgClass: isRead ? 'bg-purple-500/5 border-purple-500/20 opacity-70' : 'bg-purple-500/10 border-purple-500/40',
    }
  }
  if (notification.audience === 'branch') {
    return {
      icon: Building2,
      colorClass: isRead ? 'text-indigo-500/60' : 'text-indigo-500',
      bgClass: isRead ? 'bg-indigo-500/5 border-indigo-500/20 opacity-70' : 'bg-indigo-500/10 border-indigo-500/40',
    }
  }
  switch (notification.type) {
    case 'warning':
      return {
        icon: AlertTriangle,
        colorClass: isRead ? 'text-orange-500/60' : 'text-orange-500',
        bgClass: isRead ? 'bg-orange-500/5 border-orange-500/20 opacity-70' : 'bg-orange-500/10 border-orange-500/40',
      }
    case 'success':
      return {
        icon: CheckCircle,
        colorClass: isRead ? 'text-emerald-500/60' : 'text-emerald-500',
        bgClass: isRead ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70' : 'bg-emerald-500/10 border-emerald-500/40',
      }
    case 'error':
      return {
        icon: XCircle,
        colorClass: isRead ? 'text-red-500/60' : 'text-red-500',
        bgClass: isRead ? 'bg-red-500/5 border-red-500/20 opacity-70' : 'bg-red-500/10 border-red-500/40',
      }
    default:
      return {
        icon: Info,
        colorClass: isRead ? 'text-blue-500/60' : 'text-blue-500',
        bgClass: isRead ? 'bg-blue-500/5 border-blue-500/20 opacity-70' : 'bg-blue-500/10 border-blue-500/40',
      }
  }
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="border-dashed bg-card/30">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Bell className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">All caught up!</h3>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  )
}

function NotificationRow({
  notification,
  onMarkAsRead,
  isPending,
}: {
  notification: Notification
  onMarkAsRead?: (id: string) => void
  isPending: boolean
}) {
  const style = getNotificationStyle(notification)
  const Icon = style.icon
  // Branch / broadcast rows are shared — no per-user read state to toggle.
  const canMarkRead = onMarkAsRead && notification.audience === 'user' && !notification.is_read

  return (
    <Card className={cn('transition-colors', style.bgClass)}>
      <CardContent className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-5 w-5', style.colorClass)} />
            <h4 className={cn('text-base font-semibold', !notification.is_read ? 'text-foreground' : 'text-foreground/80')}>
              {notification.title}
            </h4>
          </div>
          <p className="text-sm text-muted-foreground/90 pl-7 sm:pl-7">{notification.message}</p>

          <div className="flex items-center gap-4 mt-2 pl-7 sm:pl-7 text-xs text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(notification.created_at).toLocaleString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>

            {notification.link && (
              <Link
                href={notification.link}
                className="flex items-center gap-1 text-sidebar-primary hover:underline"
                onClick={() => {
                  if (canMarkRead) onMarkAsRead!(notification.id)
                }}
              >
                <ExternalLink className="h-3 w-3" />
                View Details
              </Link>
            )}
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pl-7 sm:pl-0">
          {canMarkRead && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead!(notification.id)}
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
  )
}

export function NotificationsClient({
  notifications,
  branchNotifications = [],
  isChair = false,
  branchName,
  isAdmin,
}: {
  notifications: Notification[]
  branchNotifications?: Notification[]
  isChair?: boolean
  branchName?: string | null
  isAdmin?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<'personal' | 'branch'>('personal')
  const unreadCount = notifications.filter((n) => n.audience === 'user' && !n.is_read).length

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

  const showingBranch = isChair && tab === 'branch'
  const list = showingBranch ? branchNotifications : notifications

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground">Stay updated on your account activity and requests.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <BroadcastDialog />}
          {!showingBranch && unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={isPending} className="gap-2">
              <Check className="h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {isChair && (
        <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
          <button
            onClick={() => setTab('personal')}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition-colors',
              tab === 'personal' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Personal
            {unreadCount > 0 && <span className="ml-1.5 text-xs text-sidebar-primary">({unreadCount})</span>}
          </button>
          <button
            onClick={() => setTab('branch')}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition-colors',
              tab === 'branch' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {branchName ? `${branchName} activity` : 'Branch activity'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {list.length === 0 ? (
          <EmptyState
            label={showingBranch ? 'No branch activity yet.' : 'You have no notifications.'}
          />
        ) : (
          list.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkAsRead={showingBranch ? undefined : handleMarkAsRead}
              isPending={isPending}
            />
          ))
        )}
      </div>
    </div>
  )
}

function BroadcastDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await sendBroadcast(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setOpen(false), 2000)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); setSuccess(false) }}>
      <DialogTrigger render={
        <Button variant="default" size="sm" className="gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
          <Send className="h-4 w-4" />
          Send Broadcast
        </Button>
      } />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Broadcast Notification</DialogTitle>
          <DialogDescription>
            Send a notification to all users in the system.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="e.g. System Maintenance" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Notification Type</Label>
            <Select name="type" defaultValue="info">
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info (Blue)</SelectItem>
                <SelectItem value="warning">Warning / Action Req (Orange)</SelectItem>
                <SelectItem value="success">Success (Green)</SelectItem>
                <SelectItem value="error">Error (Red)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Enter your broadcast message..."
              required
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link">Link (Optional)</Label>
            <Input id="link" name="link" placeholder="e.g. /events or https://example.com" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Broadcast sent successfully!</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Sending...' : 'Send Broadcast'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
