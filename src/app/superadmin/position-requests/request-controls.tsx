'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
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
// Reuses the existing all-branch approve/reject server actions (already gate
// on `manage_positions`, pass for super admins via the `['*']` wildcard, and
// now also write `audit_log` when the actor is a super admin — see the
// additive change at the end of each action).
import { approvePositionRequest, rejectPositionRequest } from '@/app/(portal)/position-requests/actions'

type ActionResult = { success?: boolean; error?: string }

const initialState: ActionResult = {}

// ── Approve ──────────────────────────────────────────────────
// Both existing actions throw on failure (rather than returning
// `{ error }`) — caught here and converted into action state / a toast,
// matching the { success } | { error } shape the rest of this UI kit uses.

function ApproveButton({ requestId }: { requestId: string }) {
  const router = useRouter()

  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async () => {
      try {
        await approvePositionRequest(requestId)
        toast.success('Position request approved')
        router.refresh()
        return { success: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to approve request'
        toast.error(message)
        return { error: message }
      }
    },
    initialState
  )

  return (
    <form action={formAction}>
      <Button
        type="submit"
        size="sm"
        disabled={pending}
        className="bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <Check className="h-3.5 w-3.5" />
        {pending ? 'Approving...' : 'Approve'}
      </Button>
    </form>
  )
}

// ── Reject ───────────────────────────────────────────────────

function RejectButton({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const reason = String(formData.get('reason') ?? '')
      try {
        await rejectPositionRequest(requestId, reason)
        toast.success('Position request rejected')
        setOpen(false)
        router.refresh()
        return { success: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to reject request'
        toast.error(message)
        return { error: message }
      }
    },
    initialState
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive" />}
      >
        <X className="h-3.5 w-3.5" />
        Reject
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Reject Position Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this request. It will be shown to the requester.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Textarea
              name="reason"
              placeholder="e.g. This position is currently filled."
              required
              className="min-h-[100px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Row Controls ─────────────────────────────────────────────

export function RequestControls({ requestId }: { requestId: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ApproveButton requestId={requestId} />
      <RejectButton requestId={requestId} />
    </div>
  )
}
