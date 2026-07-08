import 'server-only'
import { cache } from 'react'
import bcrypt from 'bcrypt'
import { createAdminClient } from '@/utils/supabase/server'

/**
 * Pure matcher: true if `email` bcrypt-matches any row's hashed_email.
 * No IO — unit-testable.
 */
export async function matchesSuperAdmin(
  email: string,
  rows: { hashed_email: string }[]
): Promise<boolean> {
  for (const row of rows) {
    if (await bcrypt.compare(email, row.hashed_email)) return true
  }
  return false
}

/**
 * True if the email belongs to a super admin (source of truth: `superadmins`).
 * Node-only (bcrypt). Memoized per request.
 */
export const isSuperAdmin = cache(async (email: string | null | undefined): Promise<boolean> => {
  if (!email) return false
  const supabase = createAdminClient()
  const { data } = await supabase.from('superadmins').select('hashed_email')
  if (!data || data.length === 0) return false
  return matchesSuperAdmin(email, data)
})
