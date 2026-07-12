import { describe, it, expect } from 'vitest'
import {
  buildUserRow,
  buildBranchRow,
  buildBroadcastRow,
  buildCustomRow,
  satisfiesAudienceInvariant,
} from '../payload'
import { renderEvent } from '../events'

describe('notification payload builders', () => {
  it('buildUserRow sets audience=user, profile_id, and passes branch context', () => {
    const row = buildUserRow('p1', renderEvent('registration.approved', { name: 'Asha' }), {
      actorProfileId: 'admin1',
      branchId: 'b1',
    })
    expect(row.audience).toBe('user')
    expect(row.profile_id).toBe('p1')
    expect(row.branch_id).toBe('b1')
    expect(row.actor_profile_id).toBe('admin1')
    expect(row.event_key).toBe('registration.approved')
    expect(satisfiesAudienceInvariant(row)).toBe(true)
  })

  it('buildBranchRow sets audience=branch, branch_id, and NULL profile_id', () => {
    const row = buildBranchRow('b1', renderEvent('position_request.submitted', { name: 'Asha' }), {
      actorProfileId: 'req1',
    })
    expect(row.audience).toBe('branch')
    expect(row.branch_id).toBe('b1')
    expect(row.profile_id).toBeNull()
    expect(satisfiesAudienceInvariant(row)).toBe(true)
  })

  it('buildBroadcastRow leaves both profile_id and branch_id NULL', () => {
    const row = buildBroadcastRow({ title: 'Downtime', message: 'Back at 5pm' })
    expect(row.audience).toBe('broadcast')
    expect(row.profile_id).toBeNull()
    expect(row.branch_id).toBeNull()
    expect(row.type).toBe('info')
    expect(satisfiesAudienceInvariant(row)).toBe(true)
  })

  it('buildUserRow throws without a profileId', () => {
    expect(() => buildUserRow('', renderEvent('welcome'))).toThrow()
  })

  it('buildCustomRow enforces target requirements per audience', () => {
    expect(() => buildCustomRow({ audience: 'user', title: 't', message: 'm' })).toThrow()
    expect(() => buildCustomRow({ audience: 'branch', title: 't', message: 'm' })).toThrow()

    const userRow = buildCustomRow({ audience: 'user', title: 't', message: 'm', profileId: 'p1' })
    expect(satisfiesAudienceInvariant(userRow)).toBe(true)

    const branchRow = buildCustomRow({ audience: 'branch', title: 't', message: 'm', branchId: 'b1' })
    expect(satisfiesAudienceInvariant(branchRow)).toBe(true)

    const castRow = buildCustomRow({ audience: 'broadcast', title: 't', message: 'm' })
    expect(satisfiesAudienceInvariant(castRow)).toBe(true)
  })

  it('satisfiesAudienceInvariant rejects malformed rows (mirrors the DB CHECK)', () => {
    expect(
      satisfiesAudienceInvariant({
        profile_id: null, branch_id: null, audience: 'user', type: 'info',
        event_key: null, actor_profile_id: null, title: 't', message: 'm', link: null,
      }),
    ).toBe(false)

    expect(
      satisfiesAudienceInvariant({
        profile_id: 'p1', branch_id: 'b1', audience: 'branch', type: 'info',
        event_key: null, actor_profile_id: null, title: 't', message: 'm', link: null,
      }),
    ).toBe(false)
  })
})
