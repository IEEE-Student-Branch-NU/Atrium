'use client'

import { useState } from 'react'
import { PendingMember, ApprovalHistoryItem } from '@/lib/queries'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Check, X, Clock, Calendar, Mail, User, Phone, Hash } from 'lucide-react'
import { approveRegistration, rejectRegistration } from './actions'
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

// ── Components ───────────────────────────────────────────────

function PendingCard({ member }: { member: PendingMember }) {
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleApprove() {
    setIsSubmitting(true)
    try {
      await approveRegistration(member.id)
      toast.success(`${member.full_name} has been approved!`)
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
      await rejectRegistration(member.id, rejectReason)
      toast.success(`${member.full_name}'s registration was rejected.`)
      setIsRejectOpen(false)
    } catch (error: any) {
      toast.error(error.message)
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card className="flex flex-col md:flex-row overflow-hidden border-border/50">
        <div className="flex-1 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{member.full_name}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5" /> {member.email}
              </p>
            </div>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
              Pending
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-1">
                <Hash className="h-3 w-3" /> IEEE ID
              </span>
              <p className="font-mono">{member.ieee_membership_id}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-1">
                <User className="h-3 w-3" /> Section
              </span>
              <p>{member.section || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-1">
                <Phone className="h-3 w-3" /> Phone
              </span>
              <p>{member.phone || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium uppercase flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Applied On
              </span>
              <p>{new Date(member.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}</p>
            </div>
          </div>
        </div>

        {/* Actions Sidebar */}
        <div className="bg-muted/30 md:w-48 p-5 flex flex-row md:flex-col gap-3 justify-center border-t md:border-t-0 md:border-l border-border/50">
          <Button
            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleApprove}
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

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting <strong>{member.full_name}</strong>. This will be shown to them when they log in.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Invalid IEEE Membership ID. Please verify your ID on the IEEE website and try again."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
              {isSubmitting ? 'Rejecting...' : 'Reject Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function HistoryCard({ item }: { item: ApprovalHistoryItem }) {
  const isApproved = item.status === 'approved'

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/50 p-4 transition-colors hover:bg-muted/30">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{item.full_name}</h4>
          <Badge variant="outline" className={
            isApproved 
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
              : 'bg-red-500/10 text-red-600 border-red-500/20'
          }>
            {isApproved ? 'Approved' : 'Rejected'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {item.email} • ID: {item.ieee_membership_id}
        </p>
        {!isApproved && item.rejected_reason && (
          <p className="text-sm text-red-500 mt-2 bg-red-500/10 p-2 rounded-md">
            <strong>Reason:</strong> {item.rejected_reason}
          </p>
        )}
      </div>
      <div className="text-left sm:text-right text-sm text-muted-foreground space-y-1">
        <p>By {item.approver_name || 'Admin'}</p>
        <p>{new Date(item.approved_at || item.created_at).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}</p>
      </div>
    </div>
  )
}

// ── Client Wrapper ───────────────────────────────────────────

interface ApprovalsClientProps {
  pending: PendingMember[]
  history: ApprovalHistoryItem[]
}

export function ApprovalsClient({ pending, history }: ApprovalsClientProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Registration Approvals</h2>
        <p className="text-muted-foreground">
          Review and manage incoming portal access requests.
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pending">
            Pending Queue
            {pending.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-600">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6 space-y-4">
          {pending.length === 0 ? (
            <Card className="border-dashed bg-card/30">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Check className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg font-medium">All caught up!</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  There are no pending registrations waiting for your approval.
                </p>
              </CardContent>
            </Card>
          ) : (
            pending.map((member) => (
              <PendingCard key={member.id} member={member} />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Approvals & Rejections</CardTitle>
              <CardDescription>
                Showing the last 50 decisions made by admins and MDOs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">
                  No history found.
                </p>
              ) : (
                history.map((item) => (
                  <HistoryCard key={item.id} item={item} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
