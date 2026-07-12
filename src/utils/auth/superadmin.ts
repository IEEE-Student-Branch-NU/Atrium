import 'server-only'
import { cache } from 'react'
import bcrypt from 'bcrypt'
import { createAdminClient } from '@/utils/supabase/server'
import { auth } from '@/auth'
import { getImpersonatedMembershipId } from '@/utils/auth/impersonation'
import { resolveEffectiveActor, type EffectiveActor } from '@/utils/auth/effective-actor'

export type { EffectiveActor } from '@/utils/auth/effective-actor'

/**
 * Pure matcher: true if `email` bcrypt-matches any row's hashed_email.
 * No IO — unit-testable.
 */
export async function matchesSuperAdmin(
  email: string,
  rows: { email: string }[]
): Promise<boolean> {
  // Now we just do a direct string match since emails are stored directly.
  return rows.some(row => row.email.toLowerCase() === email.toLowerCase())
}

/**
 * True if the email belongs to a super admin (source of truth: `superadmins`).
 * Node-only (bcrypt). Memoized per request.
 */
export const isSuperAdmin = cache(async (email: string | null | undefined): Promise<boolean> => {
  if (!email) return false
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('superadmins').select('email')
  if (error) console.error('isSuperAdmin: failed to load superadmins', error)
  if (!data || data.length === 0) return false
  return matchesSuperAdmin(email, data)
})

/** IO wrapper: reads session + impersonation cookie, validates the target membership is active. */
export async function getEffectiveActor(): Promise<EffectiveActor> {
  const session = await auth()
  const realProfileId = session?.user?.id ?? null
  const realEmail = session?.user?.email ?? null
  const isSA = session?.isSuperAdmin === true

  let impersonatedMembership: { id: string; profile_id: string } | null = null
  if (isSA) {
    const membershipId = await getImpersonatedMembershipId()
    if (membershipId) {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('memberships')
        .select('id, profile_id')
        .eq('id', membershipId)
        .is('ended_at', null)
        .single()
      if (data) impersonatedMembership = { id: data.id, profile_id: data.profile_id }
    }
  }

  return resolveEffectiveActor({ realProfileId, realEmail, isSuperAdmin: isSA, impersonatedMembership })
}
