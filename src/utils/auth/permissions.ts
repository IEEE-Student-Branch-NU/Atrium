import { SupabaseClient } from '@supabase/supabase-js'
import { auth } from '@/auth'

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
 * Fetches all permissions a user has for a specific workspace (membership).
 *
 * Workspace-scoped permission resolution:
 * 1. SuperAdmin flag → returns ['*'] (all permissions)
 * 2. Position-based permissions → from the specific membership's position ONLY
 * 3. Direct grants → from member_permissions matching the membership's branch
 *
 * Permissions are NEVER merged across workspaces. Each workspace is independent.
 */
export async function getUserPermissions(
  supabase: SupabaseClient,
  profileId: string,
  branchId: string,
  membershipId?: string | null
): Promise<string[]> {
  // 1. Check SuperAdmin bypass from session
  const session = await auth()
  if (session?.isSuperAdmin) {
    return [WILDCARD]
  }

  const permissionNames: string[] = []

  // Direct grants are independent of the position lookup below — start the
  // query now and await it at the end so the two round-trips overlap.
  const directPermsPromise = supabase
    .from('member_permissions')
    .select('permission_id, permissions!inner(name)')
    .eq('profile_id', profileId)
    .eq('branch_id', branchId)
    .is('revoked_at', null)

  // 2. Get position-based permissions
  if (membershipId) {
    // Workspace-scoped: only the active membership's position
    const { data: membership } = await supabase
      .from('memberships')
      .select('position_id')
      .eq('id', membershipId)
      .eq('profile_id', profileId)
      .is('ended_at', null)
      .single()

    if (membership?.position_id) {
      const { data: posPerms } = await supabase
        .from('position_permissions')
        .select('permission_id, permissions!inner(name)')
        .eq('position_id', membership.position_id)

      if (posPerms) {
        for (const pp of posPerms) {
          const perm = pp.permissions as unknown as { name: string }
          if (perm?.name) {
            permissionNames.push(perm.name)
          }
        }
      }
    }
  } else {
    // Legacy fallback: all active memberships in the branch (backward compat)
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
  }

  // 3. Direct permission grants (kicked off above; await the result now).
  const { data: directPerms } = await directPermsPromise

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
  required: PermissionName,
  membershipId?: string | null
): Promise<boolean> {
  const permissions = await getUserPermissions(supabase, profileId, branchId, membershipId)
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
  // SuperAdmin check from session
  const session = await auth()
  if (session?.isSuperAdmin) return true

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
