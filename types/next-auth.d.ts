import 'next-auth'

declare module 'next-auth' {
  interface Session {
    isSuperAdmin?: boolean
    status?: string
    isMembershipComplete?: boolean
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isSuperAdmin?: boolean
    profileId?: string
    status?: string
    isMembershipComplete?: boolean
  }
}
