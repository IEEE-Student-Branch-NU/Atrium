import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getDashboardStats, getUserProfileWithMembership, getRecentActivity } from '@/lib/queries'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  UserPlus,
  Calendar,
  CalendarPlus,
  CheckSquare,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ── Helper: format time ago ──────────────────────────────────

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

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: 'created an event',
    submitted: 'submitted for approval',
    approved: 'approved an event',
    rejected: 'rejected an event',
    published: 'published an event',
    deleted: 'deleted an event',
    edited: 'edited an event',
  }
  return labels[action] || action
}

function actionColor(action: string): string {
  const colors: Record<string, string> = {
    created: 'bg-blue-500/10 text-blue-500',
    submitted: 'bg-amber-500/10 text-amber-500',
    approved: 'bg-emerald-500/10 text-emerald-500',
    rejected: 'bg-red-500/10 text-red-500',
    published: 'bg-violet-500/10 text-violet-500',
    deleted: 'bg-red-500/10 text-red-500',
    edited: 'bg-sky-500/10 text-sky-500',
  }
  return colors[action] || 'bg-muted text-muted-foreground'
}

// ── Page ─────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const actor = await getEffectiveActor()
  const profile = await getUserProfileWithMembership(actor.actingProfileId!)
  if (!profile) redirect('/login')

  const supabase = createAdminClient()
  let permissions: string[] = []
  if (profile.branch_id) {
    permissions = await getUserPermissions(supabase, profile.id, profile.branch_id)
  }

  const stats = await getDashboardStats(profile.branch_id ?? undefined)
  const recentActivity = await getRecentActivity(8)

  const canCreateEvents = hasPermission(permissions, 'create_events')
  const canApproveRegs = hasPermission(permissions, 'approve_registrations')
  const canApproveEvents = hasPermission(permissions, 'approve_events')
  const canViewMembers = hasPermission(permissions, 'view_members')
  const canManageEvents = hasPermission(permissions, 'manage_events')

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="text-2xl font-bold tracking-tight">
            {greeting}, {profile.full_name?.split(' ')[0] ?? 'there'}!
          </h2>
        </div>
        <p className="mt-1 text-muted-foreground">
          {profile.position_name
            ? `${profile.position_name} · ${profile.branch_name}`
            : profile.branch_name ?? 'IEEE SBNU Member'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Members (visible to all) */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">Approved accounts</p>
          </CardContent>
        </Card>

        {/* Pending Registrations (for approvers) */}
        {canApproveRegs && (
          <Link href="/approvals">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-amber-500/30 hover:shadow-md cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Approvals
                </CardTitle>
                <UserPlus className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats.pendingRegistrations}
                  {stats.pendingRegistrations > 0 && (
                    <Badge variant="destructive" className="ml-2 align-middle text-xs">
                      Action needed
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Total Events */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalEvents}</div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{stats.publishedEvents} published</span>
              <span>·</span>
              <span>{stats.draftEvents} drafts</span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Event Approvals (for event approvers) */}
        {canApproveEvents && (
          <Link href="/events/approvals">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-violet-500/30 hover:shadow-md cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Event Approvals
                </CardTitle>
                <CheckSquare className="h-4 w-4 text-violet-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats.pendingApprovalEvents}
                  {stats.pendingApprovalEvents > 0 && (
                    <Badge variant="secondary" className="ml-2 align-middle text-xs bg-violet-500/10 text-violet-500">
                      Pending
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Events awaiting review</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Jump to common tasks</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {canManageEvents && (
              <Link href="/events/management">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Event Management
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            )}
            {canCreateEvents && (
              <Link href="/events/create">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Create Event
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            )}
            {canApproveRegs && stats.pendingRegistrations > 0 && (
              <Link href="/approvals">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Review {stats.pendingRegistrations} Registration{stats.pendingRegistrations !== 1 ? 's' : ''}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            )}
            <Link href="/members">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  View Members
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/events">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Events
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest changes across the portal</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No activity yet. Create your first event to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-border/30 p-3 transition-colors hover:bg-muted/30"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${actionColor(item.action)}`}
                    >
                      {item.action[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{item.changed_by_name ?? 'Someone'}</span>{' '}
                        <span className="text-muted-foreground">{actionLabel(item.action)}</span>
                      </p>
                      {item.details && (item.details as any).name && (
                        <p className="truncate text-xs text-muted-foreground">
                          {(item.details as any).name}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
