import Link from 'next/link'
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAuditLog } from '@/app/superadmin/queries'

const PAGE_SIZE = 50

// ── Helper: format time ago ──────────────────────────────────
// Mirrors the formatter in src/app/superadmin/page.tsx.

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

// ── Page ─────────────────────────────────────────────────────
// Phase-1 scope: reads the `audit_log` source only (super-admin/structural
// actions). See queries.ts `getAuditLog` for the noted follow-up to merge
// the legacy event/membership audit feeds into this same view.

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  const { rows, total } = await getAuditLog({ page, pageSize: PAGE_SIZE })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams()
    params.set('page', String(targetPage))
    return `/superadmin/audit?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A feed of super-admin and structural actions across every branch.
        </p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
          <CardDescription>
            {total} event{total === 1 ? '' : 's'} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ScrollText className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                No audit events recorded yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground">
                        {timeAgo(entry.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">{entry.actor}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.action}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.entityType}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.branchName ?? '—'}
                      </TableCell>
                      <TableCell>{entry.summary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {/* A disabled `render={<Link>}` wouldn't actually stop
                    navigation — the button's `disabled:` CSS only targets
                    `:disabled` form controls, which an anchor never
                    matches — so render a plain disabled Button at the
                    boundary instead of a disabled Link. */}
                {page > 1 ? (
                  <Button variant="outline" size="sm" render={<Link href={pageHref(page - 1)} />}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                )}
                {page < totalPages ? (
                  <Button variant="outline" size="sm" render={<Link href={pageHref(page + 1)} />}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
