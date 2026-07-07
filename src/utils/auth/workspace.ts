import { cookies } from 'next/headers'

const WORKSPACE_COOKIE = 'atrium_workspace_id'

/**
 * Sets the active workspace (membership ID) in a secure cookie.
 * Persists across sessions until explicitly changed.
 */
export async function setActiveWorkspace(membershipId: string) {
  const cookieStore = await cookies()
  cookieStore.set(WORKSPACE_COOKIE, membershipId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year — persists across sessions
  })
}

/**
 * Gets the currently active workspace membership ID from the cookie.
 * Returns null if no workspace is set.
 */
export async function getActiveWorkspace(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(WORKSPACE_COOKIE)?.value ?? null
}

/**
 * Clears the active workspace cookie (e.g. on sign-out).
 */
export async function clearActiveWorkspace() {
  const cookieStore = await cookies()
  cookieStore.delete(WORKSPACE_COOKIE)
}
