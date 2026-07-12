import Link from 'next/link'
import { ChevronLeft, ChevronRight, Bell } from 'lucide-react'
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
import { getAllNotifications, getBranchOptions, getRecipientOptions } from '@/app/superadmin/queries'
import { SendNotificationDialog } from './send-notification-dialog'

export const metadata = { title: 'Notifications | Super Admin' }

const PAGE_SIZE = 50

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function targetLabel(row: { audience: string; recipient_name: string | null; branch_name: string | null }): string {
  if (row.audience === 'broadcast') return 'Everyone'
  if (row.audience === 'branch') return `${row.branch_name ?? 'Branch'} · Chairs`
  return row.recipient_name ?? 'Member'
}

const selectClass = 'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm'

export default async function SuperAdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; audience?: string; type?: string; branch?: string; q?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)
  const audience = sp.audience ?? ''
  const type = sp.type ?? ''
  const branch = sp.branch ?? ''
  const q = sp.q ?? ''

  const [{ rows, total }, branches, recipients] = await Promise.all([
    getAllNotifications({ page, pageSize: PAGE_SIZE, audience, type, branchId: branch, search: q }),
    getBranchOptions(),
    getRecipientOptions(),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams()
    params.set('page', String(targetPage))
    if (audience) params.set('audience', audience)
    if (type) params.set('type', type)
    if (branch) params.set('branch', branch)
    if (q) params.set('q', q)
    return `/superadmin/notifications?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every notification circulating across all branches. Send a new one to anyone.
          </p>
        </div>
        <SendNotificationDialog branches={branches} recipients={recipients} />
      </div>

      {/* Filters (GET form) */}
      <form method="GET" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="audience" className="text-xs text-muted-foreground">Audience</label>
          <select id="audience" name="audience" defaultValue={audience} className={selectClass}>
            <option value="">All</option>
            <option value="user">Personal</option>
            <option value="branch">Branch</option>
            <option value="broadcast">Broadcast</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-xs text-muted-foreground">Style</label>
          <select id="type" name="type" defaultValue={type} className={selectClass}>
            <option value="">All</option>
            <option value="info">Info</option>
            <option value="normal">Normal</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="branch" className="text-xs text-muted-foreground">Branch</label>
          <select id="branch" name="branch" defaultValue={branch} className={selectClass}>
            <option value="">All</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs text-muted-foreground">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="title / message" className={`${selectClass} w-48`} />
        </div>
        <Button type="submit" variant="outline" size="sm">Apply</Button>
        {(audience || type || branch || q) && (
          <Button variant="ghost" size="sm" render={<Link href="/superadmin/notifications" />}>Clear</Button>
        )}
      </form>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Feed</CardTitle>
          <CardDescription>{total} notification{total === 1 ? '' : 's'}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">No notifications match these filters.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                If you just added the notification migration, new activity will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{timeAgo(r.created_at)}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{r.audience}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                      <TableCell className="whitespace-nowrap">{targetLabel(r)}</TableCell>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell className="max-w-sm truncate text-muted-foreground" title={r.message}>{r.message}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{r.actor_name ?? 'System'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
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
