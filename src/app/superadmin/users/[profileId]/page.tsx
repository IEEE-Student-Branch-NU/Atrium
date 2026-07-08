import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, KeyRound, User as UserIcon } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAllBranches, getPositionsForBranch, type PositionOption } from '@/lib/queries'
import { getUserAdminDetail, getAllPermissions } from '../../queries'
import { openWorkspace, removePosition, revokePermission } from '../../actions'
import { AssignPositionDialog, GrantPermissionDialog } from '../user-actions'

// `openWorkspace`, `removePosition`, and `revokePermission` return `{ error }`
// on the unauthorized/not-found paths, which isn't assignable to a
// <form action> (must resolve to `void`). These inline Server Functions
// adapt them — same pattern as ../../organizations/[branchId]/page.tsx.
async function openWorkspaceAction(membershipId: string): Promise<void> {
  'use server'
  await openWorkspace(membershipId)
}

async function removePositionAction(formData: FormData): Promise<void> {
  'use server'
  await removePosition(formData)
}

async function revokePermissionAction(formData: FormData): Promise<void> {
  'use server'
  await revokePermission(formData)
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'approved') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'secondary'
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Page ─────────────────────────────────────────────────────

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params

  const [detail, branches, permissions] = await Promise.all([
    getUserAdminDetail(profileId),
    getAllBranches(),
    getAllPermissions(),
  ])
  if (!detail) notFound()

  // Positions are branch-scoped, so the assign-position dialog needs the
  // full per-branch option set up front rather than fetching on each
  // branch selection.
  const positionsByBranchEntries = await Promise.all(
    branches.map(async (b): Promise<[string, PositionOption[]]> => [b.id, await getPositionsForBranch(b.id)])
  )
  const positionsByBranch = Object.fromEntries(positionsByBranchEntries)

  const { profile, memberships, grants } = detail
  const activeMemberships = memberships.filter((m) => !m.ended_at)
  const pastMemberships = memberships.filter((m) => m.ended_at)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/superadmin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Users
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <UserIcon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">{profile.full_name || 'Unnamed'}</h1>
          <Badge variant={statusVariant(profile.status)}>{profile.status}</Badge>
        </div>
      </div>

      {/* Profile Summary */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Core information for this member.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Email</dt>
              <dd className="mt-1 text-sm">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Phone</dt>
              <dd className="mt-1 text-sm">{profile.phone || <span className="text-muted-foreground">—</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">IEEE Membership ID</dt>
              <dd className="mt-1 text-sm">
                {profile.ieee_membership_id || <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Section</dt>
              <dd className="mt-1 text-sm">{profile.section || <span className="text-muted-foreground">—</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Joined</dt>
              <dd className="mt-1 text-sm">{formatDate(profile.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">Skills</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5 text-sm">
                {profile.skills && profile.skills.length > 0 ? (
                  profile.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            {profile.bio && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium uppercase text-muted-foreground">Bio</dt>
                <dd className="mt-1 text-sm text-foreground/80">{profile.bio}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Active Positions */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Active Positions</CardTitle>
            <CardDescription>Positions this user currently holds.</CardDescription>
          </div>
          <AssignPositionDialog
            profileId={profile.id}
            branches={branches}
            positionsByBranch={positionsByBranch}
          />
        </CardHeader>
        <CardContent>
          {activeMemberships.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No active positions.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeMemberships.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.branches?.name ?? '—'}</TableCell>
                      <TableCell>{m.positions?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(m.assigned_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <form action={openWorkspaceAction.bind(null, m.id)}>
                            <Button type="submit" variant="outline" size="sm">
                              Open Workspace
                            </Button>
                          </form>
                          <form action={removePositionAction}>
                            <input type="hidden" name="membership_id" value={m.id} />
                            <Button type="submit" variant="destructive" size="sm">
                              Remove
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position History */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Position History</CardTitle>
          <CardDescription>Read-only record of past positions.</CardDescription>
        </CardHeader>
        <CardContent>
          {pastMemberships.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No past positions.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Ended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastMemberships.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.branches?.name ?? '—'}</TableCell>
                      <TableCell>{m.positions?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(m.assigned_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(m.ended_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direct Permission Grants */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Direct Permission Grants</CardTitle>
            <CardDescription>Permissions granted directly, independent of position.</CardDescription>
          </div>
          <GrantPermissionDialog profileId={profile.id} branches={branches} permissions={permissions} />
        </CardHeader>
        <CardContent>
          {grants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No direct permission grants.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grants.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.branches?.name ?? '—'}</TableCell>
                      <TableCell>{g.permissions?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(g.granted_at)}</TableCell>
                      <TableCell className="text-right">
                        <form action={revokePermissionAction}>
                          <input type="hidden" name="member_permission_id" value={g.id} />
                          <Button type="submit" variant="destructive" size="sm">
                            Revoke
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Account-level actions for this user.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            <KeyRound className="h-4 w-4" />
            Reset Password (coming soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
