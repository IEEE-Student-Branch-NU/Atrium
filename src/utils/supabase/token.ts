import { SignJWT } from 'jose'

/**
 * Mints a Supabase-compatible JWT using the NextAuth profile ID.
 * This is required for client-side Supabase Realtime subscriptions
 * since the app does not use Supabase Auth and RLS policies rely on `auth.uid()`.
 * 
 * @param profileId - The UUID of the authenticated user's profile.
 * @returns A signed JWT string valid for 1 hour.
 */
export async function createSupabaseToken(profileId: string): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error('Missing SUPABASE_JWT_SECRET environment variable')
  }

  // The secret must be converted to a Uint8Array for jose
  const encoder = new TextEncoder()
  const secretKey = encoder.encode(secret)

  // Supabase expects specific claims for an authenticated user:
  // - sub: The user's ID, which maps to auth.uid() in Postgres
  // - role: Must be 'authenticated' to bypass the anon role
  // - aud: Must be 'authenticated'
  const token = await new SignJWT({
    sub: profileId,
    role: 'authenticated',
    aud: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h') // Token expires in 1 hour
    .sign(secretKey)

  return token
}
