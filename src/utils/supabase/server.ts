import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client using the SERVICE_ROLE_KEY.
 *
 * Since NextAuth handles authentication, we no longer need cookie-based
 * Supabase clients. All database access goes through this admin client
 * which bypasses RLS (Row Level Security).
 *
 * IMPORTANT: Only use this in Server Actions and API routes — NEVER
 * expose the SERVICE_ROLE_KEY to the client/browser.
 *
 * PERFORMANCE: the client is stateless (`persistSession: false`,
 * `autoRefreshToken: false`) and holds only config + a keep-alive `fetch`
 * connection pool, so it is safe to reuse a single instance for the whole
 * server process. Re-creating it on every call (this function is invoked
 * dozens of times per request across queries/permissions/auth) needlessly
 * re-allocated the PostgREST/Realtime wiring and defeated HTTP keep-alive.
 * We memoize it at module scope; the getter keeps the original call sites
 * unchanged.
 */
let adminClient: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient

  adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return adminClient
}
