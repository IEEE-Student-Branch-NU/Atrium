import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { createAdminClient } from '@/utils/supabase/server'
import { isSuperAdmin } from '@/utils/auth/superadmin'
import authConfig from './auth.config'

// ── Fixed super-admin login ────────────────────────────────────
// One super-admin signs in with a FIXED username + password (not an email /
// Google account). The credential values are read from environment variables
// (SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD) so this public repo never
// contains the working secret — set them in the deployment env (Vercel) and in
// `.env.local` for local dev. Matching happens entirely in code below; no DB
// read at auth time. The synthetic identity's id is backed by a seeded
// `profiles` row (migration `00010_hardcoded_superadmin_profile.sql`) so audit
// / membership writes that FK-reference the acting admin resolve.
const SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD
const SUPERADMIN_ID = '11111111-1111-1111-1111-111111111111'
const SUPERADMIN_EMAIL = 'superadmin@atrium.local'

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
        isSuperAdminLogin: { label: 'isSuperAdminLogin', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string
        const isSuperAdminLogin = credentials.isSuperAdminLogin === 'true'

        // Fixed super-admin: username + password from env, checked in code.
        // No email-domain rule and no DB lookup — this path is intentionally
        // independent of Google / the `profiles` and `superadmins` tables. The
        // env guard means the path is inert (login simply fails) if the
        // credentials aren't configured, so an unset env can never match.
        if (
          isSuperAdminLogin &&
          SUPERADMIN_USERNAME &&
          SUPERADMIN_PASSWORD &&
          email === SUPERADMIN_USERNAME &&
          password === SUPERADMIN_PASSWORD
        ) {
          return {
            id: SUPERADMIN_ID,
            email: SUPERADMIN_EMAIL,
            name: 'Super Admin',
            image: null,
            isSuperAdminLogin: true,
          } as any
        }

        // Validate domain (superadmins should also be from nirmauni, but allow exception if needed. Currently required for all.)
        if (!email.endsWith('@nirmauni.ac.in')) return null

        const supabase = createAdminClient()

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, password_hash, status, ieee_membership_id')
          .eq('email', email)
          .single()

        if (!profile) return null

        let isValid = false

        if (isSuperAdminLogin) {
          // STRICT SUPERADMIN LOGIN: Only check superadmins table
          const { data: superadminRow } = await supabase
            .from('superadmins')
            .select('email, passphrase_hash')
            .eq('email', email)
            .single()

          if (superadminRow) {
            isValid = await bcrypt.compare(password, superadminRow.passphrase_hash)
          }
        } else {
          // STRICT NORMAL LOGIN: Only check profiles table
          if (profile.password_hash) {
            isValid = await bcrypt.compare(password, profile.password_hash)
          }
        }

        if (!isValid) return null

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          image: profile.avatar_url,
          isSuperAdminLogin: isSuperAdminLogin,
        } as any
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
        token.isSuperAdmin = (user as any).isSuperAdminLogin === true
        // The fixed super-admin has no email-keyed `profiles` row, so the base
        // jwt callback can't resolve `token.profileId`. Stamp it from the
        // synthetic id so `session.user.id` (required by requireSuperAdmin and
        // the audit/membership writes) is populated.
        if ((user as any).id === SUPERADMIN_ID) {
          token.profileId = SUPERADMIN_ID
        }
      }

      return token
    },
  },
})
