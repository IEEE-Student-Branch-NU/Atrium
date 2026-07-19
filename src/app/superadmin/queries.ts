import 'server-only'
import { createAdminClient } from '@/utils/supabase/server'
import { sanitizeSearchTerm } from '@/utils/search'

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
    .from('memberships').select('branch_id, profile_id').is('ended_at', null)

  const branchUsers = new Map<string, Set<string>>()
  for (const m of members ?? []) {
    if (!branchUsers.has(m.branch_id)) branchUsers.set(m.branch_id, new Set())
    branchUsers.get(m.branch_id)!.add(m.profile_id)
  }

  const nodes = new Map<string, OrgNode>()
  for (const b of branches ?? []) {
    nodes.set(b.id, { ...b, memberCount: branchUsers.get(b.id)?.size ?? 0, children: [] })
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

// `listUsers` splices the search term into a raw PostgREST `.or(...ilike...)`
// filter string below, so the term is passed through `sanitizeSearchTerm`
// (see @/utils/search) which strips the `.or()` structural chars + the `*`
// wildcard alias and backslash-escapes ILIKE `%`/`_` so they match literally.
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

// ── Notifications (oversight feed + send-dialog data) ────────
// Reads the routing columns added in migration 00011. That migration may
// not be applied yet, so every read degrades to empty rather than throwing
// (mirrors getAuditLog).

export type AdminNotificationRow = {
  id: string
  audience: string
  type: string
  event_key: string | null
  title: string
  message: string
  is_read: boolean
  created_at: string
  recipient_name: string | null
  branch_name: string | null
  actor_name: string | null
}

export async function getAllNotifications(opts: {
  audience?: string
  type?: string
  branchId?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<{ rows: AdminNotificationRow[]; total: number }> {
  const supabase = createAdminClient()
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 50
  const from = (page - 1) * pageSize

  try {
    let q = supabase
      .from('notifications')
      .select(
        `id, audience, type, event_key, title, message, is_read, created_at,
         recipient:profiles!notifications_profile_id_fkey(full_name),
         actor:profiles!notifications_actor_profile_id_fkey(full_name),
         branches(name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })

    if (opts.audience) q = q.eq('audience', opts.audience)
    if (opts.type) q = q.eq('type', opts.type)
    if (opts.branchId) q = q.eq('branch_id', opts.branchId)
    if (opts.search) {
      const term = sanitizeSearchTerm(opts.search)
      if (term) {
        const s = `%${term}%`
        q = q.or(`title.ilike.${s},message.ilike.${s}`)
      }
    }

    const { data, count, error } = await q.range(from, from + pageSize - 1)
    if (error) {
      console.error('getAllNotifications failed', error)
      return { rows: [], total: 0 }
    }

    const rows: AdminNotificationRow[] = (data ?? []).map((r) => {
      const row = r as unknown as {
        id: string; audience: string; type: string; event_key: string | null
        title: string; message: string; is_read: boolean; created_at: string
        recipient: { full_name: string | null } | null
        actor: { full_name: string | null } | null
        branches: { name: string } | null
      }
      return {
        id: row.id,
        audience: row.audience,
        type: row.type,
        event_key: row.event_key,
        title: row.title,
        message: row.message,
        is_read: row.is_read,
        created_at: row.created_at,
        recipient_name: row.recipient?.full_name ?? null,
        branch_name: row.branches?.name ?? null,
        actor_name: row.actor?.full_name ?? null,
      }
    })
    return { rows, total: count ?? 0 }
  } catch (e) {
    console.error('getAllNotifications failed', e)
    return { rows: [], total: 0 }
  }
}

/** Active workspaces (memberships) for a set of profiles — for the users-list quick open. */
export type ProfileWorkspace = { membership_id: string; branch_name: string; position_name: string }

export async function getActiveMembershipsForProfiles(
  profileIds: string[],
): Promise<Record<string, ProfileWorkspace[]>> {
  if (profileIds.length === 0) return {}
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('memberships')
    .select('id, profile_id, assigned_at, branches(name), positions(name)')
    .in('profile_id', profileIds)
    .is('ended_at', null)
    .order('assigned_at', { ascending: true })

  const map: Record<string, ProfileWorkspace[]> = {}
  for (const m of data ?? []) {
    const arr = map[m.profile_id] ?? []
    arr.push({
      membership_id: m.id,
      branch_name: (m.branches as unknown as { name: string } | null)?.name ?? 'Unknown',
      position_name: (m.positions as unknown as { name: string } | null)?.name ?? 'Member',
    })
    map[m.profile_id] = arr
  }
  return map
}

/** Branches for the send-dialog / feed filter. */
export async function getBranchOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('branches').select('id, name').order('name')
  return data ?? []
}

/** Basic user list for the targeted-send picker (capped). */
export async function getRecipientOptions(limit = 500): Promise<{ id: string; full_name: string | null; email: string }[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name')
    .limit(limit)
  return (data ?? []) as { id: string; full_name: string | null; email: string }[]
}

// ── Positions ────────────────────────────────────────────────

export type PositionGroup = {
  branchId: string; branchName: string
  positions: { id: string; name: string; permissionIds: string[] }[]
}

export async function listPositionsGrouped(): Promise<PositionGroup[]> {
  const supabase = createAdminClient()
  const { data: positions } = await supabase
    .from('positions').select('id, name, branch_id, branches(name)').order('name')
  const { data: pp } = await supabase.from('position_permissions').select('position_id, permission_id')

  const permsByPosition = new Map<string, string[]>()
  for (const row of pp ?? []) {
    const arr = permsByPosition.get(row.position_id) ?? []
    arr.push(row.permission_id)
    permsByPosition.set(row.position_id, arr)
  }
  const groups = new Map<string, PositionGroup>()
  for (const p of positions ?? []) {
    const g: PositionGroup = groups.get(p.branch_id) ?? {
      branchId: p.branch_id,
      branchName: (p.branches as unknown as { name: string } | null)?.name ?? '',
      positions: [],
    }
    g.positions.push({ id: p.id, name: p.name, permissionIds: permsByPosition.get(p.id) ?? [] })
    groups.set(p.branch_id, g)
  }
  return [...groups.values()].sort((a, b) => a.branchName.localeCompare(b.branchName))
}

// ── Position Requests (decided history) ─────────────────────
// The pending queue reuses `getPendingPositionRequests()` from
// `@/lib/queries` (already all-branch). This covers the read-only history
// of already-decided requests shown below it on the super-admin page.

export type DecidedPositionRequest = {
  id: string
  profile_id: string
  profile_name: string | null
  profile_email: string
  branch_name: string
  position_name: string
  status: string
  reason: string
  description: string | null
  supporting_notes: string | null
  admin_comment: string | null
  decided_by_name: string | null
  decided_at: string | null
  created_at: string
  profile_bio: string | null
  profile_skills: string[] | null
  profile_phone: string | null
  profile_section: string | null
  profile_ieee_membership_id: string | null
}

export async function getRecentDecidedPositionRequests(limit = 25): Promise<DecidedPositionRequest[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('position_requests')
    .select(`
      id, profile_id, status, reason, description, supporting_notes, admin_comment, decided_at, created_at,
      profiles!position_requests_profile_id_fkey(full_name, email, bio, skills, phone, section, ieee_membership_id),
      branches(name),
      positions(name),
      decided_by:profiles!position_requests_decided_by_fkey(full_name)
    `)
    .in('status', ['approved', 'rejected'])
    .order('decided_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map((r) => ({
    id: r.id,
    profile_id: r.profile_id,
    profile_name: (r.profiles as any)?.full_name ?? null,
    profile_email: (r.profiles as any)?.email ?? '',
    branch_name: (r.branches as any)?.name ?? 'Unknown',
    position_name: (r.positions as any)?.name ?? 'Unknown',
    status: r.status,
    reason: r.reason,
    description: r.description,
    supporting_notes: r.supporting_notes,
    admin_comment: r.admin_comment,
    decided_by_name: (r.decided_by as any)?.full_name ?? null,
    decided_at: r.decided_at,
    created_at: r.created_at,
    profile_bio: (r.profiles as any)?.bio ?? null,
    profile_skills: (r.profiles as any)?.skills ?? null,
    profile_phone: (r.profiles as any)?.phone ?? null,
    profile_section: (r.profiles as any)?.section ?? null,
    profile_ieee_membership_id: (r.profiles as any)?.ieee_membership_id ?? null,
  }))
}

// ── Audit Log ────────────────────────────────────────────────
// Phase-1 scope for the Audit page is the `audit_log` source only
// (super-admin/structural actions written by `logAdminAction`), filtered
// by actor and paginated. Merging the legacy `event_audit_log` /
// `membership_audit_log` feeds into this same view is a noted follow-up —
// the `source` param is left wired for that extension.
//
// The `audit_log` migration (00008) may not be applied yet in every
// environment, so this must degrade to an empty page rather than throw.

export type AuditEntry = {
  id: string; actor: string; action: string; entityType: string
  summary: string; branchName: string | null; created_at: string
  source: 'audit' | 'event' | 'membership'
}

export async function getAuditLog(opts: {
  source?: 'audit' | 'event' | 'membership'; actorId?: string; page?: number; pageSize?: number
}): Promise<{ rows: AuditEntry[]; total: number }> {
  const supabase = createAdminClient()
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 50
  const from = (page - 1) * pageSize

  try {
    let q = supabase
      .from('audit_log')
      .select(
        'id, action, entity_type, summary, created_at, branch_id, branches(name), profiles!audit_log_actor_profile_id_fkey(full_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
    if (opts.actorId) q = q.eq('actor_profile_id', opts.actorId)
    const { data, count, error } = await q.range(from, from + pageSize - 1)
    if (error) {
      console.error('getAuditLog failed', error)
      return { rows: [], total: 0 }
    }

    const rows: AuditEntry[] = (data ?? []).map((r) => {
      const row = r as unknown as {
        id: string; action: string; entity_type: string; summary: string; created_at: string
        branches: { name: string } | null
        profiles: { full_name: string | null } | null
      }
      return {
        id: row.id,
        actor: row.profiles?.full_name ?? 'Unknown',
        action: row.action,
        entityType: row.entity_type,
        summary: row.summary,
        branchName: row.branches?.name ?? null,
        created_at: row.created_at,
        source: 'audit',
      }
    })
    return { rows, total: count ?? 0 }
  } catch (e) {
    console.error('getAuditLog failed', e)
    return { rows: [], total: 0 }
  }
}

// ── Notifications ──────────────────────────────────────────────

export async function getLegacyAllNotifications(limit = 100) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('admin_notification_history')
    .select('id, broadcast_id, title, message, type, created_at, recipient_count, read_count, single_profile_id, is_edited, target_filters')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching all notifications:', error)
    return []
  }

  // Enrich personal notifications with profile info
  const profileIds = data.map(n => n.single_profile_id).filter(Boolean) as string[]
  const profilesMap = new Map<string, { full_name: string, email: string }>()
  
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds)
    
    if (profiles) {
      profiles.forEach(p => profilesMap.set(p.id, p))
    }
  }

  return data.map(n => ({
    ...n,
    profiles: n.single_profile_id ? profilesMap.get(n.single_profile_id) : null
  }))
}
