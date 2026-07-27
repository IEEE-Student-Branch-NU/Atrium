'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { setImpersonation, clearImpersonation } from '@/utils/auth/impersonation'
import { logAdminAction } from '@/utils/auth/audit'
import { getEffectiveActor, verifySuperAdminPassword } from '@/utils/auth/superadmin'
import { notifyUser, notifyBroadcast, notifyCustom } from '@/lib/notifications'
import type { NotificationSeverity } from '@/lib/notifications'

/**
 * Module-private guard: only a signed-in super admin may call the actions
 * below. Reused by later Phase-2 actions appended to this file.
 */
async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.isSuperAdmin || !session.user?.id) return null
  return session
}

export async function openWorkspace(membershipId: string) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }

  const supabase = createAdminClient()
  const { data: membership } = await supabase
    .from('memberships')
    .select('id, profile_id, branch_id, position_id, profiles(full_name), branches(name), positions(name)')
    .eq('id', membershipId)
    .is('ended_at', null)
    .single()
  if (!membership) return { error: 'Membership not found' }

  await setImpersonation(membershipId)
  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'workspace_opened',
    entityType: 'workspace',
    entityId: membershipId,
    branchId: membership.branch_id,
    summary: `Opened workspace of ${(membership.profiles as unknown as { full_name: string | null } | null)?.full_name ?? membership.profile_id}`,
    details: { membershipId, profileId: membership.profile_id },
  })
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function exitWorkspace() {
  await clearImpersonation()
  revalidatePath('/', 'layout')
  redirect('/superadmin')
}

// ── Organizations / Branches ─────────────────────────────────

export async function createOrganization(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  if (!name || !slug) return { error: 'Name and slug are required' }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('branches')
    .insert({ name, slug, description, parent_id: null })
    .select('id')
    .single()
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'org_created',
    entityType: 'organization',
    entityId: data.id,
    branchId: data.id,
    summary: `Created organization "${name}"`,
    details: { slug },
  })
  revalidatePath('/superadmin/organizations')
  return { success: true }
}

export async function createSubBranch(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const parent_id = String(formData.get('parent_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  if (!parent_id || !name || !slug) return { error: 'Parent, name, and slug are required' }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('branches')
    .insert({ name, slug, description, parent_id })
    .select('id')
    .single()
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'branch_created',
    entityType: 'branch',
    entityId: data.id,
    branchId: data.id,
    summary: `Created branch "${name}"`,
    details: { parent_id, slug },
  })
  revalidatePath('/superadmin/organizations')
  return { success: true }
}

export async function updateBranch(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  if (!id || !name || !slug) return { error: 'Name and slug are required' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('branches').update({ name, slug, description }).eq('id', id)
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'branch_updated',
    entityType: 'branch',
    entityId: id,
    branchId: id,
    summary: `Updated "${name}"`,
    details: { slug },
  })
  revalidatePath(`/superadmin/organizations/${id}`)
  revalidatePath('/superadmin/organizations')
  return { success: true }
}

// ── Users ─────────────────────────────────────────────────────

export async function assignPosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const profile_id = String(formData.get('profile_id') ?? '')
  const branch_id = String(formData.get('branch_id') ?? '')
  const position_id = String(formData.get('position_id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim() || 'Assigned by super admin'
  if (!profile_id || !branch_id || !position_id) return { error: 'Profile, branch, and position are required' }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('memberships')
    .insert({ profile_id, branch_id, position_id, assigned_by: session.user!.id, reason })
    .select('id').single()
  if (error) return { error: error.message }
  await supabase.from('membership_audit_log').insert({
    profile_id, branch_id, action: 'role_assigned', changed_by: session.user!.id,
    details: { position_id, reason, via: 'super_admin' },
  })
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_assigned', entityType: 'membership',
    entityId: data.id, branchId: branch_id, summary: `Assigned a position to a user`,
    details: { profile_id, position_id },
  })

  // Notify the promoted member (in-app + email)
  const [{ data: pos }, { data: br }] = await Promise.all([
    supabase.from('positions').select('name').eq('id', position_id).single(),
    supabase.from('branches').select('name').eq('id', branch_id).single(),
  ])
  await notifyUser({
    profileId: profile_id,
    event: 'member.promoted',
    params: { position: pos?.name ?? null, branch: br?.name ?? null },
    actorProfileId: session.user!.id,
    branchId: branch_id,
  })

  revalidatePath(`/superadmin/users/${profile_id}`)
  return { success: true }
}

export async function removePosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const membership_id = String(formData.get('membership_id') ?? '')
  const password = String(formData.get('password') ?? '')
  if (!membership_id) return { error: 'Membership required' }

  const supabase = createAdminClient()
  const { data: m } = await supabase.from('memberships')
    .select('profile_id, branch_id, position_id, positions(name)').eq('id', membership_id).single()
  
  const positionName = (m?.positions as any)?.name || (m?.positions as any)?.[0]?.name || ''
  if (positionName.toLowerCase().includes('superadmin')) {
    if (!password || !(await verifySuperAdminPassword(session.user?.email, password))) {
      return { error: 'Incorrect superadmin password' }
    }
  }

  const { error } = await supabase.from('memberships')
    .update({ ended_at: new Date().toISOString() }).eq('id', membership_id).is('ended_at', null)
  if (error) return { error: error.message }
  if (m) {
    await supabase.from('membership_audit_log').insert({
      profile_id: m.profile_id, branch_id: m.branch_id, action: 'role_revoked',
      changed_by: session.user!.id, details: { position_id: m.position_id, via: 'super_admin' },
    })
    await logAdminAction({
      actorProfileId: session.user!.id, action: 'position_removed', entityType: 'membership',
      entityId: membership_id, branchId: m.branch_id, summary: `Removed a user's position`,
      details: { profile_id: m.profile_id },
    })

    const [{ data: pos }, { data: br }] = await Promise.all([
      m.position_id
        ? supabase.from('positions').select('name').eq('id', m.position_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('branches').select('name').eq('id', m.branch_id).single(),
    ])
    await notifyUser({
      profileId: m.profile_id,
      event: 'member.position_removed',
      params: { position: pos?.name ?? null, branch: br?.name ?? null },
      actorProfileId: session.user!.id,
      branchId: m.branch_id,
    })

    revalidatePath(`/superadmin/users/${m.profile_id}`)
  }
  return { success: true }
}

export async function grantPermission(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const profile_id = String(formData.get('profile_id') ?? '')
  const branch_id = String(formData.get('branch_id') ?? '')
  const permission_id = String(formData.get('permission_id') ?? '')
  if (!profile_id || !branch_id || !permission_id) return { error: 'All fields required' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('member_permissions')
    .insert({ profile_id, branch_id, permission_id, granted_by: session.user!.id })
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'permission_granted', entityType: 'permission',
    entityId: permission_id, branchId: branch_id, summary: `Granted a permission to a user`,
    details: { profile_id, permission_id },
  })

  const [{ data: perm }, { data: br }] = await Promise.all([
    supabase.from('permissions').select('name').eq('id', permission_id).single(),
    supabase.from('branches').select('name').eq('id', branch_id).single(),
  ])
  await notifyUser({
    profileId: profile_id,
    event: 'permission.granted',
    params: { permission: perm?.name ?? null, branch: br?.name ?? null },
    actorProfileId: session.user!.id,
    branchId: branch_id,
  })

  revalidatePath(`/superadmin/users/${profile_id}`)
  return { success: true }
}

export async function revokePermission(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const member_permission_id = String(formData.get('member_permission_id') ?? '')
  if (!member_permission_id) return { error: 'Grant id required' }

  const supabase = createAdminClient()
  const { data: mp } = await supabase.from('member_permissions')
    .select('profile_id, branch_id, permission_id').eq('id', member_permission_id).single()
  const { error } = await supabase.from('member_permissions')
    .update({ revoked_at: new Date().toISOString() }).eq('id', member_permission_id).is('revoked_at', null)
  if (error) return { error: error.message }
  if (mp) {
    await logAdminAction({
      actorProfileId: session.user!.id, action: 'permission_revoked', entityType: 'permission',
      entityId: mp.permission_id, branchId: mp.branch_id, summary: `Revoked a permission`,
      details: { profile_id: mp.profile_id },
    })

    const [{ data: perm }, { data: br }] = await Promise.all([
      supabase.from('permissions').select('name').eq('id', mp.permission_id).single(),
      supabase.from('branches').select('name').eq('id', mp.branch_id).single(),
    ])
    await notifyUser({
      profileId: mp.profile_id,
      event: 'permission.revoked',
      params: { permission: perm?.name ?? null, branch: br?.name ?? null },
      actorProfileId: session.user!.id,
      branchId: mp.branch_id,
    })

    revalidatePath(`/superadmin/users/${mp.profile_id}`)
  }
  return { success: true }
}

// ── Positions ────────────────────────────────────────────────

export async function createPosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const branch_id = String(formData.get('branch_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!branch_id || !name) return { error: 'Branch and name are required' }
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('positions').insert({ branch_id, name }).select('id').single()
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_created', entityType: 'position',
    entityId: data.id, branchId: branch_id, summary: `Created position "${name}"`, details: null,
  })
  revalidatePath('/superadmin/positions')
  return { success: true }
}

export async function updatePosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!id || !name) return { error: 'Name required' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('positions').update({ name }).eq('id', id)
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_updated', entityType: 'position',
    entityId: id, summary: `Renamed a position to "${name}"`, details: null,
  })
  revalidatePath('/superadmin/positions')
  return { success: true }
}

export async function deletePosition(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Position required' }
  const supabase = createAdminClient()
  // `memberships.position_id` is FK RESTRICT (no ON DELETE) — a raw delete throws
  // an FK violation for ANY position that has ever been assigned (active OR ended).
  // Count ALL referencing memberships and fail closed if the count query errors.
  const { count, error: countError } = await supabase.from('memberships')
    .select('id', { count: 'exact', head: true }).eq('position_id', id)
  if (countError) return { error: countError.message }
  if ((count ?? 0) > 0) {
    return { error: 'Cannot delete: this position has membership history. End and reassign those members first.' }
  }
  const { error } = await supabase.from('positions').delete().eq('id', id)
  if (error) return { error: error.message }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_deleted', entityType: 'position',
    entityId: id, summary: `Deleted a position`, details: null,
  })
  revalidatePath('/superadmin/positions')
  return { success: true }
}

export async function setPositionPermissions(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const position_id = String(formData.get('position_id') ?? '')
  const permission_ids = formData.getAll('permission_ids').map(String)
  if (!position_id) return { error: 'Position required' }
  const supabase = createAdminClient()
  // Non-atomic across two REST calls: the delete clears existing mappings first,
  // so an insert failure must be surfaced (not swallowed) or the position is left
  // with zero permissions. An admin retry recovers; true atomicity would need a
  // Postgres RPC (out of scope).
  const { error: deleteError } = await supabase.from('position_permissions')
    .delete().eq('position_id', position_id)
  if (deleteError) return { error: deleteError.message }
  if (permission_ids.length > 0) {
    const { error: insertError } = await supabase.from('position_permissions')
      .insert(permission_ids.map((permission_id) => ({ position_id, permission_id })))
    if (insertError) return { error: insertError.message }
  }
  await logAdminAction({
    actorProfileId: session.user!.id, action: 'position_permissions_set', entityType: 'position',
    entityId: position_id, summary: `Updated position permissions`, details: { count: permission_ids.length },
  })
  revalidatePath('/superadmin/positions')
  return { success: true }
}

// -- Notifications: broadcast + targeted send -----------------

const NOTIFICATION_SEVERITIES: NotificationSeverity[] = ['normal', 'info', 'success', 'warning', 'error']

function coerceSeverity(value: string): NotificationSeverity {
  return (NOTIFICATION_SEVERITIES as string[]).includes(value)
    ? (value as NotificationSeverity)
    : 'info'
}

/** Legacy broadcast entry point — routed through the unified service. */
export async function sendBroadcastMessage(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }

  const title = String(formData.get('title') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  const type = coerceSeverity(String(formData.get('type') ?? 'info'))
  const link = String(formData.get('link') ?? '').trim() || null

  if (!title || !message) {
    return { error: 'Title and message are required' }
  }

  await notifyBroadcast({ title, message, type, link, actorProfileId: session.user!.id })

  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'broadcast_sent',
    entityType: 'user',
    entityId: session.user!.id,
    branchId: null,
    summary: `Sent broadcast message: "${title}"`,
    details: { type },
  })

  return { success: true }
}

/**
 * Unified super-admin send. `target` selects the audience:
 *  - 'broadcast' → everyone
 *  - 'user'      → a specific profile (`profile_id`), optionally emailed
 *  - 'branch'    → a branch's Chairs (`branch_id`)
 */
export async function sendNotification(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }

  const target = String(formData.get('target') ?? 'broadcast')
  const title = String(formData.get('title') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  const type = coerceSeverity(String(formData.get('type') ?? 'info'))
  const link = String(formData.get('link') ?? '').trim() || null

  if (!title || !message) return { error: 'Title and message are required' }

  if (target === 'user') {
    const profile_id = String(formData.get('profile_id') ?? '')
    if (!profile_id) return { error: 'Select a user to notify' }
    await notifyCustom({
      audience: 'user', profileId: profile_id, title, message, type, link,
      actorProfileId: session.user!.id,
    })
  } else if (target === 'branch') {
    const branch_id = String(formData.get('branch_id') ?? '')
    if (!branch_id) return { error: 'Select a branch to notify' }
    // Free-form branch send (custom content, not a catalog event).
    await notifyCustom({
      audience: 'branch', branchId: branch_id, title, message, type, link,
      actorProfileId: session.user!.id,
    })
  } else {
    await notifyBroadcast({ title, message, type, link, actorProfileId: session.user!.id })
  }

  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'notification_sent',
    entityType: 'user',
    entityId: session.user!.id,
    branchId: target === 'branch' ? String(formData.get('branch_id') ?? '') || null : null,
    summary: `Sent a ${target} notification: "${title}"`,
    details: { target, type },
  })

  return { success: true }
}

export async function resetUserPassword(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const profileId = String(formData.get('profile_id') ?? '')
  const newPassword = String(formData.get('password') ?? '')
  if (!profileId || !newPassword) return { error: 'Profile ID and new password required' }

  const bcrypt = (await import('bcrypt')).default
  const newHash = await bcrypt.hash(newPassword, 12)

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ password_hash: newHash })
    .eq('id', profileId)
  if (error) return { error: error.message }

  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'password_reset',
    entityType: 'user',
    entityId: profileId,
    summary: `Reset password for user`,
  })

  return { success: true }
}

export async function hardDeleteUser(formData: FormData) {
  const session = await requireSuperAdmin()
  if (!session) return { error: 'Not authorized' }
  const profileId = String(formData.get('profile_id') ?? '')
  const password = String(formData.get('password') ?? '')
  if (!profileId || !password) return { error: 'Profile ID and password required' }

  if (!(await verifySuperAdminPassword(session.user?.email, password))) {
    return { error: 'Incorrect superadmin password' }
  }

  const supabase = createAdminClient()
  
  // Get ieee_membership_id to delete from pre_approved_members if it exists
  const { data: profile } = await supabase.from('profiles').select('ieee_membership_id').eq('id', profileId).single()
  
  if (profile?.ieee_membership_id) {
    await supabase.from('pre_approved_members').delete().eq('ieee_membership_id', profile.ieee_membership_id)
  }

  // Delete user from auth, which cascades to everything else
  const { error } = await supabase.auth.admin.deleteUser(profileId)
  if (error) return { error: error.message }

  await logAdminAction({
    actorProfileId: session.user!.id,
    action: 'hard_delete_user',
    entityType: 'user',
    entityId: profileId,
    summary: `Hard deleted user from the system`,
  })

  return { success: true }
}
