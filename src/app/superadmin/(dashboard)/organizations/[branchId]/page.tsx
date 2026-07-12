import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, ExternalLink, Users as UsersIcon } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getBranchDetail, getBranchMembers, getBranchPositions, type MemberRow } from '@/app/superadmin/queries'
import { classifyMembers } from '@/utils/positions'
import { openWorkspace } from '@/app/superadmin/actions'
import { CreateOrgDialog } from '../create-org-dialog'

// `openWorkspace` returns `{ error }` on the unauthorized/not-found paths,
// which isn't assignable to a <form action> (must resolve to `void`). This
// inline Server Function adapts it — see Next's "use server inline" pattern.
async function openWorkspaceAction(membershipId: string): Promise<void> {
  'use server'
  await openWorkspace(membershipId)
}

// ── Member Table (shared across tabs) ────────────────────────

function MemberTable({ members, showUserLink }: { members: MemberRow[]; showUserLink?: boolean }) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <UsersIcon className="h-8 w-8 text-muted-foreground/30" />
        <p className="mt-2 text-sm text-muted-foreground">No members in this group.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Position</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.membership_id}>
              <TableCell className="font-medium">
                {showUserLink ? (
                  <Link
                    href={`/superadmin/users/${m.profile_id}`}
                    className="hover:underline hover:text-primary"
                  >
                    {m.full_name || 'Unnamed'}
                  </Link>
                ) : (
                  m.full_name || 'Unnamed'
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{m.email || '—'}</TableCell>
              <TableCell>{m.position_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="text-right">
                <form action={openWorkspaceAction.bind(null, m.membership_id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Open Workspace
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ branchId: string }>
}) {
  const { branchId } = await params
  const detail = await getBranchDetail(branchId)
  if (!detail) notFound()

  const [members, positions] = await Promise.all([
    getBranchMembers(branchId),
    getBranchPositions(branchId),
  ])
  const { exec, associates } = classifyMembers(members)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/superadmin/organizations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Organizations
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">{detail.name}</h1>
          <span className="text-sm text-muted-foreground">/{detail.slug}</span>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exec">Executive Committee</TabsTrigger>
          <TabsTrigger value="associates">Associate Members</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Branch Details</CardTitle>
                <CardDescription>Core information about this branch.</CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <CreateOrgDialog
                  branch={{
                    id: detail.id,
                    name: detail.name,
                    slug: detail.slug,
                    description: detail.description,
                  }}
                  triggerVariant="outline"
                  triggerSize="sm"
                />
                <CreateOrgDialog
                  parentId={detail.id}
                  parentName={detail.name}
                  triggerVariant="default"
                  triggerSize="sm"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Name</dt>
                  <dd className="mt-1 text-sm">{detail.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Slug</dt>
                  <dd className="mt-1 text-sm">/{detail.slug}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Parent</dt>
                  <dd className="mt-1 text-sm">
                    {detail.parent_id ? (
                      <Link
                        href={`/superadmin/organizations/${detail.parent_id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {detail.parentName ?? 'Parent organization'}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">None (root organization)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Total Members</dt>
                  <dd className="mt-1 text-sm">{members.length}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Description</dt>
                  <dd className="mt-1 text-sm text-foreground/80">
                    {detail.description || <span className="text-muted-foreground">No description.</span>}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Executive Committee */}
        <TabsContent value="exec">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Executive Committee</CardTitle>
              <CardDescription>Chairs, heads, and other leadership positions.</CardDescription>
            </CardHeader>
            <CardContent>
              <MemberTable members={exec} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Associate Members */}
        <TabsContent value="associates">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Associate Members</CardTitle>
              <CardDescription>All non-leadership active members.</CardDescription>
            </CardHeader>
            <CardContent>
              <MemberTable members={associates} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Positions */}
        <TabsContent value="positions">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Positions</CardTitle>
                <CardDescription>Positions defined for this branch.</CardDescription>
              </div>
              <Button variant="outline" size="sm" render={<Link href="/superadmin/positions" />}>
                Manage Positions
              </Button>
            </CardHeader>
            <CardContent>
              {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm text-muted-foreground">No positions defined for this branch yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50 rounded-md border">
                  {positions.map((p) => (
                    <li key={p.id} className="px-4 py-2.5 text-sm">
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>Every active member of this branch.</CardDescription>
            </CardHeader>
            <CardContent>
              <MemberTable members={members} showUserLink />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
