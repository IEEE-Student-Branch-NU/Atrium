import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client using the SERVICE_ROLE_KEY.
 *
 * Since NextAuth handles authentication, we no longer need cookie-based
 * Supabase clients. All database access goes through this admin client
 * which bypasses RLS (Row Level Security).
 *
 * IMPORTANT: Only use this in Server Actions and API routes — NEVER
 * expose the SERVICE_ROLE_KEY to the client/browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
