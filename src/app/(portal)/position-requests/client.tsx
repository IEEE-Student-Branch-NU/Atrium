'use client'

import { useState } from 'react'
import { PositionRequest } from '@/lib/queries'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, X, Clock, Mail, User, Briefcase, Building2 } from 'lucide-react'
import { approvePositionRequest, rejectPositionRequest } from './actions'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

// ── Request Card ──────────────────────────────────────────────

function RequestCard({ request }: { request: PositionRequest }) {
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isApproveOpen, setIsApproveOpen] = useState(false)
  const [approveComment, setApproveComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleApprove() {
    setIsSubmitting(true)
    try {
      await approvePositionRequest(request.id, approveComment)
      toast.success(`${request.profile_name}'s request for ${request.position_name} has been approved!`)
      setIsApproveOpen(false)
    } catch (error: any) {
      toast.error(error.message)
      setIsSubmitting(false)
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    setIsSubmitting(true)
    try {
      await rejectPositionRequest(request.id, rejectReason)
      toast.success(`${request.profile_name}'s request was rejected.`)
      setIsRejectOpen(false)
    } catch (error: any) {
      toast.error(error.message)
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card className="flex flex-col md:flex-row overflow-hidden border-border/50 bg-card/50">
        <div className="flex-1 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{request.profile_name ?? 'Unknown User'}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5" /> {request.profile_email}
              </p>
            </div>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
              Pending
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-3 rounded-lg border border-border/50">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Branch
              </span>
              <p className="font-medium">{request.branch_name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Position Requested
              </span>
              <p className="font-medium text-sidebar-primary">{request.position_name}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">Reason</span>
              <p className="text-sm mt-1 p-3 bg-muted/10 rounded-md border border-border/50 text-foreground/80 leading-relaxed">
                {request.reason}
              </p>
            </div>
            
            {request.description && (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">Description / Qualifications</span>
                <p className="text-sm mt-1 text-foreground/70">{request.description}</p>
              </div>
            )}
            
            {request.supporting_notes && (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">Notes</span>
                <p className="text-sm mt-1 italic text-foreground/60">{request.supporting_notes}</p>
              </div>
            )}

            <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
              <Clock className="h-3 w-3" /> 
              Submitted {new Date(request.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>

        {/* Actions Sidebar */}
        <div className="bg-muted/30 md:w-48 p-5 flex flex-row md:flex-col gap-3 justify-center border-t md:border-t-0 md:border-l border-border/50">
          <Button
            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setIsApproveOpen(true)}
            disabled={isSubmitting}
          >
            <Check className="mr-2 h-4 w-4" />
            Approve
          </Button>
          <Button
            variant="outline"
            className="flex-1 md:flex-none text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => setIsRejectOpen(true)}
            disabled={isSubmitting}
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </div>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Position Request</DialogTitle>
            <DialogDescription>
              Assign the position of <strong>{request.position_name}</strong> in <strong>{request.branch_name}</strong> to <strong>{request.profile_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Comment (Optional)</label>
              <Textarea
                placeholder="e.g. Welcome to the team! Make sure to check the drive for handover documents."
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Approving...' : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Position Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting <strong>{request.profile_name}</strong> for this position. This will be shown to them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection Reason *</label>
              <Textarea
                placeholder="e.g. We are currently not accepting applications for this position. Please try again next semester."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
              {isSubmitting ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Client Wrapper ───────────────────────────────────────────

interface PositionRequestsClientProps {
  requests: PositionRequest[]
}

export function PositionRequestsClient({ requests }: PositionRequestsClientProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Position Requests</h2>
        <p className="text-muted-foreground">
          Review and manage user requests for new positions within your branch.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {requests.length === 0 ? (
          <Card className="border-dashed bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Check className="h-6 w-6 text-emerald-500" />
              </div>
              <h3 className="text-lg font-medium">All caught up!</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                There are no pending position requests waiting for your approval.
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))
        )}
      </div>
    </div>
  )
}
