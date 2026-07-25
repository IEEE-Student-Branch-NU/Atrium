'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { Check, X, Edit, Send, MessageSquare } from 'lucide-react'
import { approveEvent, rejectEvent, publishEvent } from '../actions'

interface PendingEvent {
  id: string
  name: string
  event_date: string
  status: string
  branches: { name: string } | null
  profiles: { full_name: string | null; email: string } | null
  creator_id: string
}

export function ApprovalsClient({ 
  pendingEvents, 
  currentUserId 
}: { 
  pendingEvents: PendingEvent[]
  currentUserId: string 
}) {
  const router = useRouter()

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Event Approvals</h1>
      
      {pendingEvents && pendingEvents.length > 0 ? (
        <div className="space-y-4">
          {pendingEvents.map((event) => (
            <EventApprovalCard
              key={event.id}
              event={event}
              isOwnEvent={event.creator_id === currentUserId}
              onAction={() => router.refresh()}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">No events pending approval in your branch.</p>
        </div>
      )}
    </div>
  )
}

function EventApprovalCard({
  event,
  isOwnEvent,
  onAction,
}: {
  event: PendingEvent
  isOwnEvent: boolean
  onAction: () => void
}) {
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleApprove() {
    setLoading('approve')
    try {
      await approveEvent(event.id)
      toast.success(`"${event.name}" approved and published!`)
      onAction()
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
      onAction()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send back event')
    } finally {
      setLoading(null)
    }
  }

  async function handlePublish() {
    setLoading('publish')
    try {
      await publishEvent(event.id)
      toast.success(`"${event.name}" is now published!`)
      onAction()
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish event')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="border rounded-lg p-6 bg-card space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href={`/events/${event.id}`} className="hover:underline">
            <h3 className="text-xl font-semibold">{event.name}</h3>
          </Link>
          <div className="text-sm text-muted-foreground mt-1 space-y-1">
            <p>Branch: <span className="font-medium text-foreground">{event.branches?.name}</span></p>
            <p>Created by: <span className="font-medium text-foreground">{event.profiles?.full_name || event.profiles?.email}</span></p>
            <p>Date: {new Date(event.event_date).toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="flex gap-2 shrink-0 items-center flex-wrap">
          {isOwnEvent ? (
            <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20 px-3 py-1.5">
              Cannot approve own event
            </Badge>
          ) : (
            <>
              {/* Approve → publishes the event */}
              <Button
                onClick={handleApprove}
                disabled={loading !== null}
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
              >
                <Check className="h-4 w-4" />
                {loading === 'approve' ? 'Approving...' : 'Approve & Publish'}
              </Button>

              {/* Edit directly */}
              <Link href={`/events/${event.id}/edit`}>
                <Button variant="outline" className="gap-1.5">
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              </Link>

              {/* Send back to draft with notes */}
              <Button
                variant="outline"
                onClick={() => setShowNotes(!showNotes)}
                className="gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
              >
                <MessageSquare className="h-4 w-4" />
                Send Back
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Rejection Notes Area */}
      {showNotes && (
        <div className="border-t pt-4 space-y-3">
          <Textarea
            placeholder="Add notes explaining what needs to be changed before this event can be approved..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowNotes(false); setNotes('') }}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleSendBack}
              disabled={loading !== null || !notes.trim()}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              {loading === 'reject' ? 'Sending...' : 'Send Back to Draft'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
