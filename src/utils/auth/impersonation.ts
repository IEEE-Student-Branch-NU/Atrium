import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)
export const IMPERSONATE_COOKIE = 'atrium_impersonate'

export async function setImpersonation(membershipId: string) {
  const token = await new SignJWT({ membershipId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('4h')
    .sign(secret)
  const store = await cookies()
  store.set(IMPERSONATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4,
  })
}

export async function getImpersonatedMembershipId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(IMPERSONATE_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    return typeof payload.membershipId === 'string' ? payload.membershipId : null
  } catch {
    return null
  }
}

export async function clearImpersonation() {
  const store = await cookies()
  store.delete(IMPERSONATE_COOKIE)
}
