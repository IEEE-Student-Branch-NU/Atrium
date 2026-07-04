import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)

export async function enableSudoMode(email: string) {
  const token = await new SignJWT({ email, sudo: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set('sudo_mode', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7200, // 2 hours
  })
}

export async function isSudoMode() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sudo_mode')?.value
  if (!token) return false

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.sudo === true
  } catch {
    return false
  }
}

export async function disableSudoMode() {
  const cookieStore = await cookies()
  cookieStore.delete('sudo_mode')
}
