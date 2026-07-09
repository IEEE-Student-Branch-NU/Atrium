import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { createAdminClient } from '@/utils/supabase/server'
import { isSuperAdmin } from '@/utils/auth/superadmin'
import authConfig from './auth.config'

/**
 * Main Auth.js v5 configuration (Node.js runtime).
 * We merge the edge-compatible `authConfig` with the Node.js-only
 * Credentials provider (which uses bcrypt).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string

        // Validate domain
        if (!email.endsWith('@nirmauni.ac.in')) return null

        const supabase = createAdminClient()

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, password_hash, status, ieee_membership_id')
          .eq('email', email)
          .single()

        if (!profile || !profile.password_hash) return null

        // Verify bcrypt hash
        const isValid = await bcrypt.compare(password, profile.password_hash)
        if (!isValid) return null

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          image: profile.avatar_url,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Override `jwt`: delegate to the edge-safe base callback (which sets
    // token.profileId/status/isMembershipComplete), then stamp
    // `isSuperAdmin` once at sign-in. bcrypt is only available here in the
    // Node runtime — never call `isSuperAdmin` from anything auth.config.ts
    // pulls into the Edge middleware bundle.
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params)
      if (!token) return token

      const { user } = params
      if (user) {
        token.isSuperAdmin = await isSuperAdmin(user.email ?? token.email ?? null)
      }

      return token
    },
  },
})
