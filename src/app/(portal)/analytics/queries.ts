import { createAdminClient } from '@/utils/supabase/server'

export interface BranchStats {
  name: string
  members: number
}

export interface FunnelStats {
  totalSignups: number
  pending: number
  approved: number
  rejected: number
}

export interface RegistrationTrend {
  date: string
  count: number
}

export async function getAnalyticsData() {
  const supabase = createAdminClient()

  // The membership and profile reads are independent — fetch concurrently.
  // The membership and profile reads are independent — fetch concurrently.
  const [membershipsRes, profilesRes] = await Promise.all([
    supabase.from('memberships').select('branch_id, profile_id, branches(name)').is('ended_at', null),
    supabase.from('profiles').select('id, status, created_at'),
  ])

  const profiles = profilesRes.data || []
  
  // Create a fast lookup for approved profile IDs
  const approvedProfileIds = new Set(
    profiles.filter(p => p.status === 'approved').map(p => p.id)
  )

  // 1. Branch distribution (Unique Approved Members per branch)
  const activeMemberships = membershipsRes.data

  const branchCounts: Record<string, Set<string>> = {}
  if (activeMemberships) {
    activeMemberships.forEach(m => {
      // Only count if the profile is currently approved
      if (approvedProfileIds.has(m.profile_id)) {
        const branchName = (m.branches as any)?.name ?? 'Unknown'
        if (!branchCounts[branchName]) branchCounts[branchName] = new Set()
        branchCounts[branchName].add(m.profile_id)
      }
    })
  }
  
  const branchStats: BranchStats[] = Object.keys(branchCounts).map(name => ({
    name,
    members: branchCounts[name].size
  }))

  // 2. Funnel Stats


  const funnel: FunnelStats = {
    totalSignups: profiles?.length ?? 0,
    pending: profiles?.filter(p => p.status === 'pending').length ?? 0,
    approved: profiles?.filter(p => p.status === 'approved').length ?? 0,
    rejected: profiles?.filter(p => p.status === 'rejected').length ?? 0,
  }

  // 3. Registration Trends (last 30 days)
  const trendsMap: Record<string, number> = {}
  
  // Initialize last 30 days with 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    trendsMap[dateStr] = 0
  }

  if (profiles) {
    profiles.forEach(p => {
      const d = new Date(p.created_at)
      // Only count if it's within our initialized keys
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (trendsMap[dateStr] !== undefined) {
        trendsMap[dateStr]++
      }
    })
  }

  const registrationTrends: RegistrationTrend[] = Object.keys(trendsMap).map(date => ({
    date,
    count: trendsMap[date]
  }))

  return { branchStats, funnel, registrationTrends }
}
