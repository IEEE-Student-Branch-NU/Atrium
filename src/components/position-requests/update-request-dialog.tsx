'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updatePositionRequestStatus } from '@/app/(portal)/position-requests/actions'

type ActionResult = { success?: boolean; error?: string }

const initialState: ActionResult = {}

export function UpdateRequestDialog({ 
  requestId, 
  currentStatus, 
  currentComment 
}: { 
  requestId: string
  currentStatus: string
  currentComment: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [comment, setComment] = useState(currentComment || '')

  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async () => {
      try {
        await updatePositionRequestStatus(requestId, status, comment)
        toast.success('Request updated successfully')
        setOpen(false)
        router.refresh()
        return { success: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to update request'
        toast.error(message)
        return { error: message }
      }
    },
    initialState
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="gap-2 w-full md:w-auto text-primary hover:text-primary hover:bg-primary/10" />}
      >
        <Edit2 className="h-3.5 w-3.5" />
        Update Status
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Update Request</DialogTitle>
            <DialogDescription>
              Change the status of this position request and provide an admin comment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Comment</label>
              <Textarea
                name="reason"
                placeholder="Optional comment to attach to this request..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
