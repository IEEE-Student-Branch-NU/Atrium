import { describe, it, expect } from 'vitest'
import bcrypt from 'bcrypt'
import { matchesSuperAdmin } from '@/utils/auth/superadmin'

describe('matchesSuperAdmin', () => {
  it('returns true when the email matches a hashed_email row', async () => {
    const rows = [{ hashed_email: bcrypt.hashSync('ieee@nirmauni.ac.in', 10) }]
    expect(await matchesSuperAdmin('ieee@nirmauni.ac.in', rows)).toBe(true)
  })

  it('returns false when no row matches', async () => {
    const rows = [{ hashed_email: bcrypt.hashSync('ieee@nirmauni.ac.in', 10) }]
    expect(await matchesSuperAdmin('someone@nirmauni.ac.in', rows)).toBe(false)
  })

  it('returns false for empty rows', async () => {
    expect(await matchesSuperAdmin('ieee@nirmauni.ac.in', [])).toBe(false)
  })
})
