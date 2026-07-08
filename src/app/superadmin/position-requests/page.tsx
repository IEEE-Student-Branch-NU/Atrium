import { Briefcase, Building2, Clock, Inbox, Mail } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getPendingPositionRequests } from '@/lib/queries'
import { getRecentDecidedPositionRequests } from '../queries'
import { RequestControls } from './request-controls'

const HISTORY_LIMIT = 25

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function statusVariant(status: string): 'default' | 'destructive' {
  return status === 'approved' ? 'default' : 'destructive'
}

// ── Page ─────────────────────────────────────────────────────
// Reuses the existing all-branch pending queue (`getPendingPositionRequests`)
// and the existing approve/reject server actions — see ./request-controls.tsx.
// Only the decided-request history query below is new.

export default async function SuperAdminPositionRequestsPage() {
  const [pending, history] = await Promise.all([
    getPendingPositionRequests(),
    getRecentDecidedPositionRequests(HISTORY_LIMIT),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Position Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review pending position requests across every branch and approve or reject them.
        </p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Pending</CardTitle>
          <CardDescription>
            {pending.length} request{pending.length === 1 ? '' : 's'} awaiting a decision
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">No pending position requests.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 rounded-md border">
              {pending.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{req.profile_name ?? 'Unknown user'}</span>
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
                  <RequestControls requestId={req.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Recently Decided</CardTitle>
          <CardDescription>
            The last {history.length} approved or rejected request{history.length === 1 ? '' : 's'}, most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">No decided requests yet.</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.profile_name ?? 'Unknown user'}</TableCell>
                      <TableCell className="text-muted-foreground">{req.branch_name}</TableCell>
                      <TableCell>{req.position_name}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {req.decided_by_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(req.decided_at)}</TableCell>
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
