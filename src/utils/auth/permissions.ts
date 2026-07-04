import { SupabaseClient } from '@supabase/supabase-js'
import { isSudoMode } from '@/utils/auth/sudo'

export type PermissionName =
  | 'create_events'
  | 'approve_events'
  | 'manage_events'
  | 'manage_members'
  | 'approve_registrations'
  | 'view_members'
  | 'view_audit_log'
  | 'manage_event_types'
  | 'manage_positions'

const WILDCARD = '*'

/**
 * Fetches all permissions a user has in a specific branch.
 *
 * Permission sources (in order of precedence):
 * 1. SuperAdmin flag on profiles → returns ['*'] (all permissions)
 * 2. Position-based permissions → from position_permissions via active membership
 * 3. Direct grants → from member_permissions (ad-hoc overrides)
 *
 * Results are deduplicated and returned as an array of permission name strings.
 */
export async function getUserPermissions(
  supabase: SupabaseClient,
  profileId: string,
  branchId: string
): Promise<string[]> {
  // 1. Check SuperAdmin bypass from signed secure cookie
  if (await isSudoMode()) {
    return [WILDCARD]
  }

  const permissionNames: string[] = []

  // 2. Get position-based permissions via active memberships
  const { data: memberships } = await supabase
    .from('memberships')
    .select('position_id')
    .eq('profile_id', profileId)
    .eq('branch_id', branchId)
    .is('ended_at', null)

  if (memberships && memberships.length > 0) {
    const positionIds = memberships
      .map((m) => m.position_id)
      .filter(Boolean) as string[]

    if (positionIds.length > 0) {
      const { data: posPerms } = await supabase
        .from('position_permissions')
        .select('permission_id, permissions!inner(name)')
        .in('position_id', positionIds)

      if (posPerms) {
        for (const pp of posPerms) {
          const perm = pp.permissions as unknown as { name: string }
          if (perm?.name) {
            permissionNames.push(perm.name)
          }
        }
      }
    }
  }

  // 3. Get direct permission grants
  const { data: directPerms } = await supabase
    .from('member_permissions')
    .select('permission_id, permissions!inner(name)')
    .eq('profile_id', profileId)
    .eq('branch_id', branchId)
    .is('revoked_at', null)

  if (directPerms) {
    for (const dp of directPerms) {
      const perm = dp.permissions as unknown as { name: string }
      if (perm?.name) {
        permissionNames.push(perm.name)
      }
    }
  }

  // 4. Deduplicate
  return [...new Set(permissionNames)]
}

/**
 * Checks if a permission set includes the required permission.
 * Handles the SuperAdmin wildcard ('*').
 */
export function hasPermission(
  permissions: string[],
  required: PermissionName
): boolean {
  return permissions.includes(WILDCARD) || permissions.includes(required)
}

/**
 * Checks if a user has a specific permission in a branch.
 * Convenience wrapper combining getUserPermissions + hasPermission.
 */
export async function checkPermission(
  supabase: SupabaseClient,
  profileId: string,
  branchId: string,
  required: PermissionName
): Promise<boolean> {
  const permissions = await getUserPermissions(supabase, profileId, branchId)
  return hasPermission(permissions, required)
}

/**
 * Checks if a user has the approve_registrations permission in ANY branch.
 * Used for the registration approval queue (not scoped to a single branch).
 */
export async function canApproveRegistrations(
  supabase: SupabaseClient,
  profileId: string
): Promise<boolean> {
  // SuperAdmin check from signed secure cookie
  if (await isSudoMode()) return true

  // Check if user holds any position with approve_registrations in any branch
  const { data: memberships } = await supabase
    .from('memberships')
    .select('position_id')
    .eq('profile_id', profileId)
    .is('ended_at', null)

  if (!memberships || memberships.length === 0) return false

  const positionIds = memberships
    .map((m) => m.position_id)
    .filter(Boolean) as string[]

  if (positionIds.length === 0) return false

  const { data: posPerms } = await supabase
    .from('position_permissions')
    .select('permissions!inner(name)')
    .in('position_id', positionIds)
    .eq('permissions.name', 'approve_registrations')

  return (posPerms && posPerms.length > 0) || false
}
