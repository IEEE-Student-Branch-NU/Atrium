import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getEffectiveActor } from '@/utils/auth/superadmin'
import { getActiveWorkspace } from '@/utils/auth/workspace'
import { createAdminClient } from '@/utils/supabase/server'
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { getUserProfileWithMembership } from '@/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollText } from 'lucide-react'

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
    created: 'Created an event',
    submitted: 'Submitted event for approval',
    approved: 'Approved an event',
    rejected: 'Rejected an event',
    published: 'Published an event',
    deleted: 'Deleted an event',
    edited: 'Edited an event',
    member_added: 'Approved a new member',
    member_removed: 'Removed a member',
    event_drafted: 'Drafted an event',
    event_permitted: 'Permitted an event',
  }
  return labels[action] || action.replace(/_/g, ' ')
}

function actionColor(action: string): string {
  const colors: Record<string, string> = {
    created: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    submitted: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    published: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    deleted: 'bg-red-500/10 text-red-500 border-red-500/20',
    edited: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    member_added: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    member_removed: 'bg-red-500/10 text-red-500 border-red-500/20',
    event_drafted: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    event_permitted: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  }
  return colors[action] || 'bg-muted text-muted-foreground border-border'
}

export default async function AuditLogPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const supabase = createAdminClient()
  const actor = await getEffectiveActor()

  const activeWorkspaceId = actor.isImpersonating
    ? actor.actingMembershipId
    : await getActiveWorkspace()

  const profile = await getUserProfileWithMembership(actor.actingProfileId!, activeWorkspaceId)

  if (!profile || !profile.branch_id) {
    redirect('/login')
  }

  const permissions = await getUserPermissions(supabase, profile.id, profile.branch_id, profile.membership_id)

  if (!hasPermission(permissions, 'view_audit_log')) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">Unauthorized</h1>
        <p className="text-muted-foreground mt-2">You do not have permission to view the audit log.</p>
      </div>
    )
  }

  // Fetch audit log entries — only portal-relevant entity types
  const { data: auditEntries } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, summary, details, created_at, profiles!audit_log_actor_profile_id_fkey(full_name)')
    .eq('branch_id', profile.branch_id)
    .in('entity_type', ['event', 'user', 'membership'])
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Recent activity across {profile.branch_name}
          </p>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {auditEntries && auditEntries.length > 0 ? (
            <div className="space-y-4">
              {auditEntries.map((entry) => {
                const actorName = (entry.profiles as any)?.full_name ?? 'System'
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 rounded-lg border border-border/50 bg-background/50 p-4"
                  >
                    {/* Avatar circle */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {actorName.charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{actorName}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase ${actionColor(entry.action)}`}
                        >
                          {entry.action.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {actionLabel(entry.action)}
                      </p>
                      {entry.summary && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {entry.summary}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>No activity recorded yet.</p>
              <p className="text-xs mt-1">Activity will appear here as events are created, approved, and members join.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
