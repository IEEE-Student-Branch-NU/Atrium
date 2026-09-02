'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import Link from 'next/link'
import { Check, X, Edit, MessageSquare, CalendarIcon, Trash2 } from 'lucide-react'
import { approveEvent, rejectEvent, publishEvent, deleteEvent } from '@/app/(portal)/events/actions'

interface GlobalEvent {
  id: string
  name: string
  event_date: string
  status: string
  banner: any
  branches: { name: string } | null
  profiles: { full_name: string | null; email: string } | null
  creator_id: string | null
  creator_snapshot: { id: string; full_name: string | null; email: string | null } | null
}

function creatorLabel(event: GlobalEvent): string {
  if (event.profiles) return event.profiles.full_name || event.profiles.email
  const snap = event.creator_snapshot
  if (snap) return `${snap.full_name || snap.email || 'Unknown'} (deleted)`
  return 'Deleted user'
}

export function SuperadminEventsClient({ events }: { events: GlobalEvent[] }) {
  const pendingEvents = events.filter(e => e.status === 'pending_approval')
  const otherEvents = events.filter(e => e.status !== 'pending_approval')

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Global Events Management</h1>
        <p className="text-muted-foreground">
          View and manage all events across all branches as a Superadmin.
        </p>
      </div>

      {pendingEvents.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Pending Approval 
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30">
                {pendingEvents.length}
              </Badge>
            </CardTitle>
            <CardDescription>Events waiting for approval across all branches.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingEvents.map(event => (
              <EventApprovalCard key={event.id} event={event} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">All Events</CardTitle>
          <CardDescription>View and manage active and past events globally.</CardDescription>
        </CardHeader>
        <CardContent>
          {otherEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events found.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {otherEvents.map(event => (
                <GlobalEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EventApprovalCard({ event }: { event: GlobalEvent }) {
  const router = useRouter()
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleApprove() {
    setLoading('approve')
    try {
      await approveEvent(event.id)
      toast.success(`"${event.name}" approved and published!`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve event')
    } finally {
      setLoading(null)
    }
  }

  async function handleSendBack() {
    if (!notes.trim()) {
      toast.error('Please add notes explaining what needs to change.')
      return
    }
    setLoading('reject')
    try {
      await rejectEvent(event.id, notes)
      toast.success(`"${event.name}" sent back to draft with notes.`)
      setNotes('')
      setShowNotes(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send back event')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-4 flex flex-col gap-4">
      <div>
        <div className="flex justify-between items-start gap-2 mb-2">
          <Link href={`/events/${event.id}`} className="hover:underline line-clamp-1 flex-1 font-semibold">
            {event.name}
          </Link>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-[10px] uppercase shrink-0">
            PENDING
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <CalendarIcon className="w-3 h-3" />
          {new Date(event.event_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="text-xs text-muted-foreground mb-1">
          Branch: <span className="font-medium text-foreground">{event.branches?.name}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          By: <span className="font-medium text-foreground">{creatorLabel(event)}</span>
        </div>
      </div>
      
      <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-border/50">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={loading !== null}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            {loading === 'approve' ? '...' : 'Approve'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNotes(!showNotes)}
            className="flex-1 gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Send Back
          </Button>
        </div>
        
        {showNotes && (
          <div className="space-y-2 mt-2">
            <Textarea
              placeholder="Rejection notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px] text-xs"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowNotes(false); setNotes('') }}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={handleSendBack}
                disabled={loading !== null || !notes.trim()}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function GlobalEventCard({ event }: { event: GlobalEvent }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-500',
    pending_approval: 'bg-amber-500/10 text-amber-500',
    published: 'bg-emerald-500/10 text-emerald-500',
    rejected: 'bg-red-500/10 text-red-500',
  }

  const isFree = event.banner?.is_free ?? true

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete "${event.name}"?`)) return
    setIsDeleting(true)
    try {
      await deleteEvent(event.id)
      toast.success('Event deleted successfully')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete event')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-4 flex flex-col gap-4">
      <div>
        <div className="flex justify-between items-start gap-2 mb-2">
          <Link href={`/events/${event.id}`} className="hover:underline line-clamp-1 flex-1 font-semibold">
            {event.name}
          </Link>
          <Badge variant="secondary" className={`text-[10px] uppercase shrink-0 ${statusColors[event.status] || ''}`}>
            {event.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <CalendarIcon className="w-3 h-3" />
          {new Date(event.event_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="text-xs text-muted-foreground mb-1">
          Branch: <span className="font-medium text-foreground">{event.branches?.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-[10px]">{isFree ? 'Free' : 'Paid'}</Badge>
        </div>
      </div>
      
      <div className="mt-auto flex items-center gap-2 pt-4 border-t border-border/50">
        <Link href={`/events/${event.id}/edit`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full flex items-center gap-2">
            <Edit className="w-3 h-3" /> Edit
          </Button>
        </Link>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 flex items-center gap-2"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
      </div>
    </div>
  )
}
