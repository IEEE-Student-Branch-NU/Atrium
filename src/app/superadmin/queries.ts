import 'server-only'
import { createAdminClient } from '@/utils/supabase/server'

// ── Stats ────────────────────────────────────────────────────

export async function getSuperAdminStats() {
  const supabase = createAdminClient()
  const [users, branches, roots, positions, reqs] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('branches').select('id', { count: 'exact', head: true }),
    supabase.from('branches').select('id', { count: 'exact', head: true }).is('parent_id', null),
    supabase.from('positions').select('id', { count: 'exact', head: true }),
    supabase.from('position_requests').select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'under_review']),
  ])
  return {
    totalUsers: users.count ?? 0,
    totalBranches: branches.count ?? 0,
    totalOrganizations: roots.count ?? 0,
    totalPositions: positions.count ?? 0,
    pendingPositionRequests: reqs.count ?? 0,
  }
}

// ── Organization Tree ────────────────────────────────────────

export type OrgNode = {
  id: string; name: string; slug: string; description: string | null
  parent_id: string | null; memberCount: number; children: OrgNode[]
}

export async function getOrganizationTree(): Promise<OrgNode[]> {
  const supabase = createAdminClient()
  const { data: branches } = await supabase
    .from('branches').select('id, name, slug, description, parent_id').order('name')
  const { data: members } = await supabase
    .from('memberships').select('branch_id').is('ended_at', null)

  const counts = new Map<string, number>()
  for (const m of members ?? []) counts.set(m.branch_id, (counts.get(m.branch_id) ?? 0) + 1)

  const nodes = new Map<string, OrgNode>()
  for (const b of branches ?? []) {
    nodes.set(b.id, { ...b, memberCount: counts.get(b.id) ?? 0, children: [] })
  }
  const roots: OrgNode[] = []
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) nodes.get(node.parent_id)!.children.push(node)
    else roots.push(node)
  }
  return roots
}

// ── Recent Activity Feed ─────────────────────────────────────

export type ActivityItem = {
  id: string; actor: string; summary: string; created_at: string
  source: 'audit' | 'event' | 'membership'
}

export async function getRecentActivityFeed(limit = 10): Promise<ActivityItem[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('audit_log')
    .select('id, summary, created_at, profiles!audit_log_actor_profile_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id,
    actor: (r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? 'Unknown',
    summary: r.summary,
    created_at: r.created_at,
    source: 'audit' as const,
  }))
}
