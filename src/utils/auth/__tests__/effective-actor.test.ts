import { describe, it, expect } from 'vitest'
import { resolveEffectiveActor } from '@/utils/auth/effective-actor'

describe('resolveEffectiveActor', () => {
  it('acts as self when not impersonating', () => {
    const a = resolveEffectiveActor({
      realProfileId: 'sa-1', realEmail: 'ieee@nirmauni.ac.in', isSuperAdmin: true,
      impersonatedMembership: null,
    })
    expect(a.isImpersonating).toBe(false)
    expect(a.actingProfileId).toBe('sa-1')
    expect(a.actingMembershipId).toBe(null)
  })

  it('acts as target membership when a super admin impersonates', () => {
    const a = resolveEffectiveActor({
      realProfileId: 'sa-1', realEmail: 'ieee@nirmauni.ac.in', isSuperAdmin: true,
      impersonatedMembership: { id: 'm-9', profile_id: 'user-7' },
    })
    expect(a.isImpersonating).toBe(true)
    expect(a.actingProfileId).toBe('user-7')
    expect(a.actingMembershipId).toBe('m-9')
  })

  it('ignores impersonation for a non-super-admin', () => {
    const a = resolveEffectiveActor({
      realProfileId: 'user-2', realEmail: 'x@nirmauni.ac.in', isSuperAdmin: false,
      impersonatedMembership: { id: 'm-9', profile_id: 'user-7' },
    })
    expect(a.isImpersonating).toBe(false)
    expect(a.actingProfileId).toBe('user-2')
  })
})
