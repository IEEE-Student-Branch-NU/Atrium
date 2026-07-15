import { createAdminClient } from '@/utils/supabase/server'

// ── Dashboard Stats ──────────────────────────────────────────

export interface DashboardStats {
  totalMembers: number
  pendingRegistrations: number
  totalEvents: number
  draftEvents: number
  pendingApprovalEvents: number
  publishedEvents: number
}

export async function getDashboardStats(branchId?: string): Promise<DashboardStats> {
  const supabase = createAdminClient()

  // These three reads are independent — run them concurrently so the total
  // latency is one round-trip, not three.
  let eventsQuery = supabase.from('events').select('status')
  if (branchId) {
    eventsQuery = eventsQuery.eq('branch_id', branchId)
  }

  const [membersRes, pendingRes, eventsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    eventsQuery,
  ])

  const totalMembers = membersRes.count
  const pendingRegistrations = pendingRes.count
  const events = eventsRes.data

  const totalEvents = events?.length ?? 0
  const draftEvents = events?.filter((e) => e.status === 'draft').length ?? 0
  const pendingApprovalEvents = events?.filter((e) => e.status === 'pending_approval').length ?? 0
  const publishedEvents = events?.filter((e) => e.status === 'published').length ?? 0

  return {
    totalMembers: totalMembers ?? 0,
    pendingRegistrations: pendingRegistrations ?? 0,
    totalEvents,
    draftEvents,
    pendingApprovalEvents,
    publishedEvents,
  }
}

// ── Recent Activity ──────────────────────────────────────────

export interface ActivityItem {
  id: string
  action: string
  event_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  changed_by_name: string | null
}

export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('event_audit_log')
    .select('id, action, event_id, details, created_at, profiles!event_audit_log_changed_by_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map((item) => ({
    id: item.id,
    action: item.action,
    event_id: item.event_id,
    details: item.details as Record<string, unknown> | null,
    created_at: item.created_at,
    changed_by_name: (item.profiles as any)?.full_name ?? null,
  }))
}

// ── User Profile with Memberships ────────────────────────────

export interface UserProfileWithMembership {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  ieee_membership_id: string | null
  status: string
  bio: string | null
  skills: string[] | null
  section: string | null
  created_at: string
  branch_name: string | null
  branch_id: string | null
  branch_slug: string | null
  position_name: string | null
  position_id: string | null
  membership_id: string | null
}

/**
 * Fetch profile + resolve the active workspace membership.
 * If activeMembershipId is provided, uses that specific membership.
 * Otherwise falls back to the first active membership.
 */
export async function getUserProfileWithMembership(
  profileId: string,
  activeMembershipId?: string | null
): Promise<UserProfileWithMembership | null> {
  const supabase = createAdminClient()
  const MEMBERSHIP_COLS = 'id, branch_id, position_id, branches(name, slug), positions(name)'

  const firstActiveMembership = () =>
    supabase
      .from('memberships')
      .select(MEMBERSHIP_COLS)
      .eq('profile_id', profileId)
      .is('ended_at', null)
      .order('assigned_at', { ascending: true })
      .limit(1)
      .single()

  // The profile read and the primary membership read are independent — run
  // them concurrently. If a specific membership was requested but not found,
  // fall back to the first active membership (rare second round-trip).
  const primaryMembership = () =>
    activeMembershipId
      ? supabase
          .from('memberships')
          .select(MEMBERSHIP_COLS)
          .eq('id', activeMembershipId)
          .eq('profile_id', profileId)
          .is('ended_at', null)
          .single()
      : firstActiveMembership()

  const [{ data: profile }, primaryRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, phone, ieee_membership_id, status, bio, skills, section, created_at')
      .eq('id', profileId)
      .single(),
    primaryMembership(),
  ])

  if (!profile) return null

  let membership: any = primaryRes.data
  if (!membership && activeMembershipId) {
    membership = (await firstActiveMembership()).data
  }

  return {
    ...profile,
    branch_name: (membership?.branches as any)?.name ?? null,
    branch_id: membership?.branch_id ?? null,
    branch_slug: (membership?.branches as any)?.slug ?? null,
    position_name: (membership?.positions as any)?.name ?? null,
    position_id: membership?.position_id ?? null,
    membership_id: membership?.id ?? null,
  }
}

// ── All User Memberships (for Role Switcher) ─────────────────

export interface UserMembership {
  id: string
  branch_id: string
  branch_name: string
  branch_slug: string
  position_id: string | null
  position_name: string | null
  assigned_at: string
}

export async function getAllUserMemberships(profileId: string): Promise<UserMembership[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('memberships')
    .select('id, branch_id, position_id, assigned_at, branches(name, slug), positions(name)')
    .eq('profile_id', profileId)
    .is('ended_at', null)
    .order('assigned_at', { ascending: true })

  if (!data) return []

  return data.map((m) => ({
    id: m.id,
    branch_id: m.branch_id,
    branch_name: (m.branches as any)?.name ?? 'Unknown',
    branch_slug: (m.branches as any)?.slug ?? '',
    position_id: m.position_id,
    position_name: (m.positions as any)?.name ?? 'Member',
    assigned_at: m.assigned_at,
  }))
}

// ── Full User Profile (for About Me page) ────────────────────

export interface FullUserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  ieee_membership_id: string | null
  section: string | null
  bio: string | null
  skills: string[] | null
  status: string
  has_password?: boolean
  created_at: string
  memberships: {
    id: string
    branch_name: string
    branch_slug: string
    position_name: string | null
    assigned_at: string
    ended_at: string | null
    assigned_by_name: string | null
    is_active: boolean
  }[]
}

export async function getFullUserProfile(profileId: string): Promise<FullUserProfile | null> {
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, phone, ieee_membership_id, section, bio, skills, status, created_at, password_hash')
    .eq('id', profileId)
    .single()

  if (!profile) return null

  const has_password = !!profile.password_hash
  delete (profile as any).password_hash

  // All memberships (active + historical)
  const { data: memberships, error: memError } = await supabase
    .from('memberships')
    .select('id, assigned_at, ended_at, branches(name, slug), positions(name), profiles!memberships_assigned_by_fkey(full_name)')
    .eq('profile_id', profileId)
    .order('assigned_at', { ascending: false })

  if (memError) {
    console.error('Error fetching memberships:', memError)
  }

  return {
    ...profile,
    has_password,
    memberships: (memberships ?? []).map((m) => ({
      id: m.id,
      branch_name: (m.branches as any)?.name ?? 'Unknown',
      branch_slug: (m.branches as any)?.slug ?? '',
      position_name: (m.positions as any)?.name ?? 'Member',
      assigned_at: m.assigned_at,
      ended_at: m.ended_at,
      assigned_by_name: (m.profiles as any)?.full_name ?? null,
      is_active: m.ended_at === null,
    })),
  }
}

// ── Notifications ────────────────────────────────────────────

export interface Notification {
  id: string
  title: string
  message: string
  link: string | null
  is_read: boolean
  // `type` = visual severity; `broadcast` retained for legacy rows not yet backfilled.
  type: 'normal' | 'info' | 'success' | 'warning' | 'error' | 'broadcast'
  audience: 'user' | 'branch' | 'broadcast'
  branch_id: string | null
  event_key: string | null
  created_at: string
}

// Shared column list — keeps every notification read in sync with the interface.
const NOTIFICATION_COLUMNS = 'id, title, message, link, is_read, type, audience, branch_id, event_key, created_at'

/**
 * Personal unread notifications (drives the top-bar badge). Personal only —
 * broadcasts are single shared rows with no per-user read state, so counting
 * them would leave the badge permanently lit.
 */
export async function getUnreadNotifications(profileId: string): Promise<Notification[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('profile_id', profileId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) console.error('Error fetching unread notifications:', error)
  return (data ?? []) as unknown as Notification[]
}

/** The member's notification list: their personal rows plus org-wide broadcasts. */
export async function getNotifications(profileId: string, limit = 50): Promise<Notification[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .or(`profile_id.eq.${profileId},audience.eq.broadcast`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) console.error('Error fetching notifications:', error)
  return (data ?? []) as unknown as Notification[]
}

/** Branch-activity feed for a Chair: notifications routed to a branch. */
export async function getBranchNotifications(branchId: string, limit = 50): Promise<Notification[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('audience', 'branch')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) console.error('Error fetching branch notifications:', error)
  return (data ?? []) as unknown as Notification[]
}

// ── Position Requests ────────────────────────────────────────

export interface PositionRequest {
  id: string
  profile_id: string
  profile_name: string | null
  profile_email: string
  profile_phone?: string | null
  profile_ieee_membership_id?: string | null
  profile_section?: string | null
  profile_skills?: string[] | null
  profile_bio?: string | null
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
}

export async function getPendingPositionRequests(): Promise<PositionRequest[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('position_requests')
    .select(`
      id, profile_id, status, reason, description, supporting_notes,
      admin_comment, decided_at, created_at,
      profiles!position_requests_profile_id_fkey(full_name, email),
      branches(name),
      positions(name),
      decided_by:profiles!position_requests_decided_by_fkey(full_name)
    `)
    .in('status', ['pending', 'under_review'])
    .order('created_at', { ascending: true })

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
  }))
}

export async function getCancelledPositionRequests(): Promise<PositionRequest[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('position_requests')
    .select(`
      id, profile_id, status, reason, description, supporting_notes,
      admin_comment, decided_at, created_at,
      profiles!position_requests_profile_id_fkey(full_name, email),
      branches(name),
      positions(name),
      decided_by:profiles!position_requests_decided_by_fkey(full_name)
    `)
    .eq('status', 'cancelled')
    .order('created_at', { ascending: false })

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
  }))
}

export async function getDecidedPositionRequests(): Promise<PositionRequest[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('position_requests')
    .select(`
      id, profile_id, status, reason, description, supporting_notes,
      admin_comment, decided_at, created_at,
      profiles!position_requests_profile_id_fkey(full_name, email),
      branches(name),
      positions(name),
      decided_by:profiles!position_requests_decided_by_fkey(full_name)
    `)
    .in('status', ['approved', 'rejected'])
    .order('decided_at', { ascending: false })

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
  }))
}

export async function getUserPositionRequests(profileId: string): Promise<PositionRequest[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('position_requests')
    .select(`
      id, profile_id, status, reason, description, supporting_notes,
      admin_comment, decided_at, created_at,
      profiles!position_requests_profile_id_fkey(full_name, email),
      branches(name),
      positions(name),
      decided_by:profiles!position_requests_decided_by_fkey(full_name)
    `)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

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
  }))
}

// ── Branches & Positions (for dropdowns) ─────────────────────

export interface BranchOption {
  id: string
  name: string
  slug: string
}

export interface PositionOption {
  id: string
  name: string
  branch_id: string
}

export async function getAllBranches(): Promise<BranchOption[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('branches')
    .select('id, name, slug')
    .order('name')
  return data ?? []
}

export async function getPositionsForBranch(branchId: string): Promise<PositionOption[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('positions')
    .select('id, name, branch_id')
    .eq('branch_id', branchId)
    .order('name')
  return data ?? []
}

/**
 * All positions across all branches, grouped by branch id, in ONE query.
 * Use this instead of calling getPositionsForBranch per branch (N+1).
 */
export async function getPositionsGroupedByBranch(): Promise<Record<string, PositionOption[]>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('positions')
    .select('id, name, branch_id')
    .order('name')

  const grouped: Record<string, PositionOption[]> = {}
  for (const p of data ?? []) {
    ;(grouped[p.branch_id] ??= []).push(p as PositionOption)
  }
  return grouped
}

// ── Pending Registrations ────────────────────────────────────

export interface PendingMember {
  id: string
  full_name: string | null
  email: string
  ieee_membership_id: string | null
  phone: string | null
  section: string | null
  created_at: string
}

export async function getPendingRegistrations(): Promise<PendingMember[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, ieee_membership_id, phone, section, created_at')
    .eq('status', 'pending')
    .not('ieee_membership_id', 'is', null)
    .order('created_at', { ascending: true })

  return data ?? []
}

// ── Approval History ─────────────────────────────────────────

export interface ApprovalHistoryItem {
  id: string
  full_name: string | null
  email: string
  ieee_membership_id: string | null
  status: string
  rejected_reason: string | null
  approved_at: string | null
  created_at: string
  approver_name: string | null
}

export async function getApprovalHistory(limit = 50): Promise<ApprovalHistoryItem[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, ieee_membership_id, status, rejected_reason, approved_at, created_at, profiles!profiles_approved_by_fkey(full_name)')
    .in('status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((item) => ({
    id: item.id,
    full_name: item.full_name,
    email: item.email,
    ieee_membership_id: item.ieee_membership_id,
    status: item.status,
    rejected_reason: item.rejected_reason,
    approved_at: item.approved_at,
    created_at: item.created_at,
    approver_name: (item.profiles as any)?.full_name ?? null,
  }))
}

// ── Pre-Approved Members ─────────────────────────────────────

export interface PreApprovedMember {
  id: string
  ieee_membership_id: string
  name: string
  email: string | null
  created_at: string
  added_by_name: string | null
  is_claimed: boolean
}

export async function getPreApprovedMembers(): Promise<PreApprovedMember[]> {
  const supabase = createAdminClient()

  // We need to know if the member is claimed, which means a profile exists with this ieee_membership_id
  const { data: preApproved } = await supabase
    .from('pre_approved_members')
    .select('id, ieee_membership_id, name, email, created_at, profiles!pre_approved_members_added_by_fkey(full_name)')
    .order('created_at', { ascending: false })

  if (!preApproved) return []

  // Check which ones are claimed
  const { data: profiles } = await supabase
    .from('profiles')
    .select('ieee_membership_id')
    .not('ieee_membership_id', 'is', null)

  const claimedIds = new Set(profiles?.map(p => p.ieee_membership_id) ?? [])

  return preApproved.map(item => ({
    id: item.id,
    ieee_membership_id: item.ieee_membership_id,
    name: item.name,
    email: item.email,
    created_at: item.created_at,
    added_by_name: (item.profiles as any)?.full_name ?? null,
    is_claimed: claimedIds.has(item.ieee_membership_id),
  }))
}

// ── Members Directory ────────────────────────────────────────

export interface DirectoryMember {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  ieee_membership_id: string | null
  phone: string | null
  section: string | null
  status: string
  created_at: string
  branch_name: string | null
  position_name: string | null
}

export async function getMembersDirectory(): Promise<DirectoryMember[]> {
  const supabase = createAdminClient()

  // Fetch all approved profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, ieee_membership_id, phone, section, status, created_at')
    .eq('status', 'approved')
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error fetching members directory:', error)
    return []
  }

  if (!profiles || profiles.length === 0) return []

  // Fetch active memberships for all profiles in one query
  const profileIds = profiles.map(p => p.id)
  const { data: memberships } = await supabase
    .from('memberships')
    .select('profile_id, branches(name), positions(name)')
    .in('profile_id', profileIds)
    .is('ended_at', null)

  // Build a lookup: profile_id → { branch_name, position_name }
  const membershipMap = new Map<string, { branch_name: string | null; position_name: string | null }>()
  for (const m of memberships ?? []) {
    // If a user has multiple memberships, prefer the one with a position
    const existing = membershipMap.get(m.profile_id)
    const posName = (m.positions as any)?.name ?? null
    const branchName = (m.branches as any)?.name ?? null
    if (!existing || (posName && !existing.position_name)) {
      membershipMap.set(m.profile_id, { branch_name: branchName, position_name: posName })
    }
  }

  return profiles.map(p => ({
    ...p,
    branch_name: membershipMap.get(p.id)?.branch_name ?? null,
    position_name: membershipMap.get(p.id)?.position_name ?? null,
  }))
}
