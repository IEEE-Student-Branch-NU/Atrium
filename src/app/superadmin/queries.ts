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

// ── Branch Detail ────────────────────────────────────────────

export type MemberRow = {
  membership_id: string
  profile_id: string
  full_name: string
  email: string
  position_name: string | null
}

export type BranchDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  parentName: string | null
}

export async function getBranchDetail(branchId: string): Promise<BranchDetail | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('branches')
    .select('id, name, slug, description, parent_id, parent:branches!parent_id(name)')
    .eq('id', branchId)
    .single()
  if (!data) return null

  const { parent, ...branch } = data as unknown as {
    id: string
    name: string
    slug: string
    description: string | null
    parent_id: string | null
    parent: { name: string } | null
  }
  return { ...branch, parentName: parent?.name ?? null }
}

export async function getBranchMembers(branchId: string): Promise<MemberRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('memberships')
    .select('id, profile_id, profiles!memberships_profile_id_fkey(full_name, email), positions(name)')
    .eq('branch_id', branchId)
    .is('ended_at', null)
  return (data ?? []).map((m) => ({
    membership_id: m.id,
    profile_id: m.profile_id,
    full_name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? '',
    email: (m.profiles as unknown as { email: string | null } | null)?.email ?? '',
    position_name: (m.positions as unknown as { name: string } | null)?.name ?? null,
  }))
}

export async function getBranchPositions(branchId: string): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('positions')
    .select('id, name')
    .eq('branch_id', branchId)
    .order('name')
  return data ?? []
}

// ── Users ────────────────────────────────────────────────────

export type UserRow = {
  id: string
  full_name: string
  email: string
  ieee_membership_id: string | null
  status: string
}

export type UserAdminProfile = {
  id: string
  full_name: string | null
  email: string
  ieee_membership_id: string | null
  phone: string | null
  section: string | null
  status: string
  bio: string | null
  skills: string[] | null
  created_at: string
}

export type UserMembershipRow = {
  id: string
  branch_id: string
  position_id: string | null
  assigned_at: string
  ended_at: string | null
  branches: { name: string } | null
  positions: { name: string } | null
}

export type UserGrantRow = {
  id: string
  branch_id: string
  granted_at: string
  revoked_at: string | null
  branches: { name: string } | null
  permissions: { name: string } | null
}

export type PermissionRow = { id: string; name: string; description: string | null }

/**
 * `listUsers`'s search term is spliced directly into a raw PostgREST
 * `.or(...)` filter string below. Commas separate conditions and
 * parentheses group them in that mini-language, so an unescaped one typed
 * into the search box could inject extra clauses or unbalance the filter.
 * `%`/`_` are SQL ILIKE wildcards, stripped so a search can't be broadened
 * beyond a literal substring match. Stripping (rather than escaping) is
 * sufficient here since the search box only needs literal substring
 * matching, not literal-wildcard search.
 */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()%_]/g, '').trim()
}

export async function listUsers(opts: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<{ rows: UserRow[]; total: number }> {
  const supabase = createAdminClient()
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 25
  const from = (page - 1) * pageSize
  let q = supabase.from('profiles').select('id, full_name, email, ieee_membership_id, status', { count: 'exact' })
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.search) {
    const term = sanitizeSearchTerm(opts.search)
    if (term) {
      const s = `%${term}%`
      q = q.or(`full_name.ilike.${s},email.ilike.${s},ieee_membership_id.ilike.${s}`)
    }
  }
  const { data, count } = await q.order('full_name').range(from, from + pageSize - 1)
  return { rows: (data ?? []) as UserRow[], total: count ?? 0 }
}

export async function getUserAdminDetail(profileId: string): Promise<{
  profile: UserAdminProfile
  memberships: UserMembershipRow[]
  grants: UserGrantRow[]
} | null> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, ieee_membership_id, phone, section, status, bio, skills, created_at')
    .eq('id', profileId).single()
  if (!profile) return null
  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, branch_id, position_id, assigned_at, ended_at, branches(name), positions(name)')
    .eq('profile_id', profileId).order('assigned_at', { ascending: false })
  const { data: grants } = await supabase
    .from('member_permissions')
    .select('id, branch_id, granted_at, revoked_at, branches(name), permissions(name)')
    .eq('profile_id', profileId).is('revoked_at', null)
  return {
    profile: profile as unknown as UserAdminProfile,
    memberships: (memberships ?? []) as unknown as UserMembershipRow[],
    grants: (grants ?? []) as unknown as UserGrantRow[],
  }
}

export async function getAllPermissions(): Promise<PermissionRow[]> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('permissions').select('id, name, description').order('name')
  return data ?? []
}
