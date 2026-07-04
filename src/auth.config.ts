import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { createAdminClient } from '@/utils/supabase/server'

/**
 * NextAuth configuration for Edge runtime.
 * We extract this to avoid importing Node.js modules like `bcrypt` in the Edge
 * middleware. The Credentials provider (which uses bcrypt) is added in `auth.ts`.
 */
export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          hd: 'nirmauni.ac.in',
        },
      },
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        if (!user.email?.endsWith('@nirmauni.ac.in')) {
          return '/login?error=unauthorized_domain'
        }

        const supabase = createAdminClient()

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .single()

        if (!existingProfile) {
          const { error } = await supabase.from('profiles').insert({
            id: crypto.randomUUID(),
            email: user.email,
            full_name: user.name || null,
            avatar_url: user.image || null,
            status: 'pending',
          })

          if (error) {
            console.error('Failed to create profile for Google user:', error)
            return false
          }
        }
      }
      return true
    },

    async jwt({ token, trigger }) {
      if (trigger === 'signIn' || trigger === 'signUp') {
        const supabase = createAdminClient()

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, status, ieee_membership_id')
          .eq('email', token.email!)
          .single()

        if (profile) {
          token.profileId = profile.id
          token.status = profile.status
          token.isMembershipComplete = !!profile.ieee_membership_id
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.profileId as string
        ;(session as any).status = token.status
        ;(session as any).isMembershipComplete = token.isMembershipComplete
      }
      return session
    },
  },
} satisfies NextAuthConfig
