import { describe, it, expect } from 'vitest'
import { matchesSuperAdmin } from '@/utils/auth/superadmin'

describe('matchesSuperAdmin', () => {
  it('returns true when the email matches a row', async () => {
    const rows = [{ email: 'ieee@nirmauni.ac.in' }]
    expect(await matchesSuperAdmin('ieee@nirmauni.ac.in', rows)).toBe(true)
  })

  it('handles case-insensitive matching', async () => {
    const rows = [{ email: 'IEEE@nirmauni.ac.in' }]
    expect(await matchesSuperAdmin('ieee@nirmauni.ac.in', rows)).toBe(true)
  })

  it('returns false when no row matches', async () => {
    const rows = [{ email: 'ieee@nirmauni.ac.in' }]
    expect(await matchesSuperAdmin('someone@nirmauni.ac.in', rows)).toBe(false)
  })

  it('returns false for empty rows', async () => {
    expect(await matchesSuperAdmin('ieee@nirmauni.ac.in', [])).toBe(false)
  })
})
