import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Users,
  Building2,
  GitBranch,
  BadgeCheck,
  Inbox,
  Activity,
  Clock,
} from 'lucide-react'
import {
  getSuperAdminStats,
  getOrganizationTree,
  getRecentActivityFeed,
  type OrgNode,
} from '@/app/superadmin/queries'
import { SendBroadcastDialog } from '@/components/superadmin/send-broadcast-dialog'

// ── Helper: format time ago ──────────────────────────────────
// Mirrors the formatter in src/app/(portal)/page.tsx.

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

// ── Organization Tree Row (recursive) ────────────────────────

function OrgTreeRow({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <div>
      <Link
        href={`/superadmin/organizations/${node.id}`}
        className="flex items-center justify-between gap-3 rounded-lg py-2 pr-3 text-sm transition-colors hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {depth === 0 ? (
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          )}
          <span className={depth === 0 ? 'font-semibold' : 'font-medium'}>{node.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">/{node.slug}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {node.memberCount} member{node.memberCount === 1 ? '' : 's'}
        </span>
      </Link>
      {node.children.map((child) => (
        <OrgTreeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default async function SuperAdminDashboardPage() {
  const [stats, orgTree, activity] = await Promise.all([
    getSuperAdminStats(),
    getOrganizationTree(),
    getRecentActivityFeed(8),
  ])

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, href: '/superadmin/users' },
    {
      label: 'Total Organizations',
      value: stats.totalOrganizations,
      icon: Building2,
      href: '/superadmin/organizations',
    },
    {
      label: 'Total Branches',
      value: stats.totalBranches,
      icon: GitBranch,
      href: '/superadmin/organizations',
    },
    {
      label: 'Total Positions',
      value: stats.totalPositions,
      icon: BadgeCheck,
      href: '/superadmin/positions',
    },
    {
      label: 'Pending Position Requests',
      value: stats.pendingPositionRequests,
      icon: Inbox,
      href: '/superadmin/position-requests',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Super Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization-wide overview across every branch and member.
          </p>
        </div>
        <SendBroadcastDialog />
      </div>

      {/* Stat Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground/60" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Recent Activity — a nav card, not a stat. `activity.length` saturates
            at the `getRecentActivityFeed(8)` limit, so it isn't a real total;
            link out to the full audit log instead of showing a misleading number. */}
        <Link href="/superadmin/audit">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Recent Activity
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground/60" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium text-primary">View audit log &rarr;</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Organizations & Branches */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Organizations &amp; Branches</CardTitle>
            <CardDescription>Hierarchy and active member counts</CardDescription>
          </CardHeader>
          <CardContent>
            {orgTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">No organizations yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {orgTree.map((root) => (
                  <OrgTreeRow key={root.id} node={root} depth={0} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Activities</CardTitle>
            <CardDescription>Latest super-admin and structural actions</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No recent activity yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-border/30 p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {item.actor[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{item.actor}</span>{' '}
                        <span className="text-muted-foreground">{item.summary}</span>
                      </p>
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
