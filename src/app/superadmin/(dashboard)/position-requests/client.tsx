'use client'

import { useState } from 'react'
import { Inbox, Check, X, Clock, Mail, Briefcase, Building2, Search, UserPlus, Slash } from 'lucide-react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UpdateRequestDialog } from '@/components/position-requests/update-request-dialog'
import { RequesterProfileDialog } from '@/components/position-requests/requester-profile-dialog'
import { PositionRequest } from '@/lib/queries'
import { DecidedPositionRequest } from '@/app/superadmin/queries'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function statusVariant(status: string): 'default' | 'destructive' | 'secondary' {
  if (status === 'approved') return 'default'
  if (status === 'rejected' || status === 'cancelled') return 'destructive'
  return 'secondary'
}

interface SuperAdminPositionRequestsClientProps {
  pending: PositionRequest[]
  history: DecidedPositionRequest[]
  cancelled: PositionRequest[]
}

export function SuperAdminPositionRequestsClient({ pending, history, cancelled }: SuperAdminPositionRequestsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filterRequest = (req: PositionRequest | DecidedPositionRequest) => {
    const term = searchTerm.toLowerCase()
    return (
      (req.profile_name ?? '').toLowerCase().includes(term) ||
      (req.profile_email ?? '').toLowerCase().includes(term) ||
      (req.position_name ?? '').toLowerCase().includes(term) ||
      (req.branch_name ?? '').toLowerCase().includes(term)
    )
  }

  const filteredPending = pending.filter(filterRequest)
  const filteredHistory = history.filter(filterRequest)
  const filteredCancelled = cancelled.filter(filterRequest)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row justify-between items-start md:items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Position Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review pending position requests across every branch and approve or reject them.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto items-center gap-3">
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
          
          <Button variant="outline" className="w-full sm:w-auto" render={<Link href="/superadmin/users" className="inline-flex items-center justify-center whitespace-nowrap" />}>
            <UserPlus className="mr-2 h-4 w-4" />
            Direct Assign User
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Pending</CardTitle>
          <CardDescription>
            {filteredPending.length} request{filteredPending.length === 1 ? '' : 's'} awaiting a decision
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                {searchTerm ? 'No matching pending requests.' : 'No pending position requests.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 rounded-md border">
              {filteredPending.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <RequesterProfileDialog request={req}>
                        <button className="font-medium hover:underline text-left">
                          {req.profile_name ?? 'Unknown user'}
                        </button>
                      </RequesterProfileDialog>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /> {req.profile_email}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {req.branch_name}
                      </span>
                      <span className="flex items-center gap-1 text-foreground">
                        <Briefcase className="h-3 w-3" /> {req.position_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDate(req.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80">{req.reason}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <UpdateRequestDialog 
                      requestId={req.id} 
                      currentStatus={req.status} 
                      currentComment={req.admin_comment} 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(filteredCancelled.length > 0 || searchTerm) && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Cancelled Requests</CardTitle>
            <CardDescription>
              These requests were cancelled. You can revert them if this was a mistake.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCancelled.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Slash className="h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchTerm ? 'No matching cancelled requests.' : 'No cancelled requests.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 rounded-md border">
                {filteredCancelled.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <RequesterProfileDialog request={req}>
                          <button className="font-medium hover:underline text-left">
                            {req.profile_name ?? 'Unknown user'}
                          </button>
                        </RequesterProfileDialog>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {req.profile_email}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {req.branch_name}
                        </span>
                        <span className="flex items-center gap-1 text-foreground">
                          <Briefcase className="h-3 w-3" /> {req.position_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDate(req.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80">{req.reason}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <UpdateRequestDialog 
                        requestId={req.id} 
                        currentStatus={req.status} 
                        currentComment={req.admin_comment} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Recently Decided</CardTitle>
          <CardDescription>
            The last {history.length} approved or rejected request{history.length === 1 ? '' : 's'}, most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'No matching decided requests.' : 'No decided requests yet.'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Decided By</TableHead>
                    <TableHead>Decided</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        <RequesterProfileDialog request={req}>
                          <button className="font-medium hover:underline text-left">
                            {req.profile_name ?? 'Unknown user'}
                          </button>
                        </RequesterProfileDialog>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{req.branch_name}</TableCell>
                      <TableCell>{req.position_name}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {req.decided_by_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(req.decided_at)}</TableCell>
                      <TableCell>
                        <UpdateRequestDialog 
                          requestId={req.id} 
                          currentStatus={req.status} 
                          currentComment={req.admin_comment} 
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
