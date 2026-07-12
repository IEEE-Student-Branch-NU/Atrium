import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search, Users as UsersIcon } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listUsers, getActiveMembershipsForProfiles } from '@/app/superadmin/queries'
import { OpenWorkspaceMenu } from '@/components/superadmin/open-workspace-menu'

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'approved') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'secondary'
}

// ── Page ─────────────────────────────────────────────────────

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = sp.q ?? ''
  // The Select below uses a sentinel "all" value (Select items can't cleanly
  // round-trip an empty string through defaultValue), translated to "no
  // status filter" here.
  const statusParam = sp.status ?? 'all'
  const status = statusParam === 'all' ? '' : statusParam
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  const { rows, total } = await listUsers({
    search: q || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // One batched query for the visible page → per-user "Open workspace" access.
  const workspacesByProfile = await getActiveMembershipsForProfiles(rows.map((u) => u.id))

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    params.set('page', String(targetPage))
    return `/superadmin/users?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search every registered member and manage their positions and permissions.
        </p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Search
              </label>
              <Input
                id="q"
                name="q"
                placeholder="Name, email, or IEEE ID"
                defaultValue={q}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select name="status" defaultValue={statusParam}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            {total} member{total === 1 ? '' : 's'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <UsersIcon className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">No users match this search.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>IEEE ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Workspace</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/superadmin/users/${u.id}`}
                          className="hover:underline hover:text-primary"
                        >
                          {u.full_name || 'Unnamed'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                      <TableCell>
                        {u.ieee_membership_id ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <OpenWorkspaceMenu
                          memberships={workspacesByProfile[u.id] ?? []}
                          userName={u.full_name || 'this user'}
                        />
                      </TableCell>
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
