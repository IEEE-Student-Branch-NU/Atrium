'use client'

import { useState } from 'react'
import { PositionRequest } from '@/lib/queries'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X, Clock, Mail, User, Briefcase, Building2, Search, Slash } from 'lucide-react'
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
import { UpdateRequestDialog } from '@/components/position-requests/update-request-dialog'
import { RequesterProfileDialog } from '@/components/position-requests/requester-profile-dialog'
// ── Request Card ──────────────────────────────────────────────

function RequestCard({ request }: { request: PositionRequest }) {
  return (
    <>
      <Card className="flex flex-col md:flex-row overflow-hidden border-border/50 bg-card/50">
        <div className="flex-1 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <RequesterProfileDialog request={request}>
                <button className="text-lg font-semibold hover:underline text-left">
                  {request.profile_name ?? 'Unknown User'}
                </button>
              </RequesterProfileDialog>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5" /> {request.profile_email}
              </p>
            </div>
            <Badge 
              variant={request.status === 'cancelled' ? 'destructive' : 'secondary'} 
              className={request.status === 'pending' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : ''}
            >
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
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
          <UpdateRequestDialog 
            requestId={request.id} 
            currentStatus={request.status} 
            currentComment={request.admin_comment} 
          />
        </div>
      </Card>
    </>
  )
}

// ── Client Wrapper ───────────────────────────────────────────

interface PositionRequestsClientProps {
  requests: PositionRequest[]
  cancelledRequests: PositionRequest[]
  decidedRequests: PositionRequest[]
}

export function PositionRequestsClient({ 
  requests, 
  cancelledRequests, 
  decidedRequests 
}: PositionRequestsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filterRequest = (req: PositionRequest) => {
    const term = searchTerm.toLowerCase()
    return (
      (req.profile_name ?? '').toLowerCase().includes(term) ||
      (req.profile_email ?? '').toLowerCase().includes(term) ||
      (req.position_name ?? '').toLowerCase().includes(term) ||
      (req.branch_name ?? '').toLowerCase().includes(term)
    )
  }

  const filteredPending = requests.filter(filterRequest)
  const filteredCancelled = cancelledRequests.filter(filterRequest)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Position Requests</h2>
          <p className="text-muted-foreground">
            Review and manage user requests for new positions within your branch.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search requests..."
            className="pl-9 bg-card/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <h3 className="text-lg font-medium">Pending Requests</h3>
        {filteredPending.length === 0 ? (
          <Card className="border-dashed bg-card/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Check className="h-6 w-6 text-emerald-500" />
              </div>
              <h3 className="text-lg font-medium">No pending requests</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {searchTerm ? 'Try adjusting your search terms.' : 'There are no pending position requests waiting for your approval.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPending.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))
        )}
      </div>

      {(filteredCancelled.length > 0 || searchTerm) && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-medium text-destructive">Cancelled Requests</h3>
          <p className="text-sm text-muted-foreground">
            These requests were cancelled. You can revert them if this was a mistake.
          </p>
          {filteredCancelled.length === 0 ? (
             <Card className="border-dashed bg-card/30">
               <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                 <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                   <Slash className="h-6 w-6 text-muted-foreground" />
                 </div>
                 <h3 className="text-lg font-medium">No cancelled requests</h3>
                 <p className="text-sm text-muted-foreground max-w-sm mt-1">
                   {searchTerm ? 'Try adjusting your search terms.' : ''}
                 </p>
               </CardContent>
             </Card>
          ) : (
            filteredCancelled.map((req) => (
              <RequestCard key={req.id} request={req} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
