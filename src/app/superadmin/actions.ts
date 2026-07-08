'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { createAdminClient } from '@/utils/supabase/server'
import { setImpersonation, clearImpersonation } from '@/utils/auth/impersonation'
import { logAdminAction } from '@/utils/auth/audit'

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
