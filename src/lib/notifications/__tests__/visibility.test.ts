import { describe, it, expect } from 'vitest'
import { isChairPosition, chairBranchIds, CHAIR_POSITION_NAME } from '../visibility'

describe('branch-activity visibility', () => {
  it('recognises the Chair position (case-sensitive, matches RLS)', () => {
    expect(isChairPosition('Chair')).toBe(true)
    expect(isChairPosition('chair')).toBe(false)
    expect(isChairPosition('Vice Chair')).toBe(false)
    expect(isChairPosition(null)).toBe(false)
    expect(isChairPosition(undefined)).toBe(false)
    expect(CHAIR_POSITION_NAME).toBe('Chair')
  })

  it('returns branch ids where the user is an active Chair only', () => {
    const memberships = [
      { branch_id: 'cs', position_name: 'Chair' },
      { branch_id: 'itss', position_name: 'Technical Head' },
      { branch_id: 'wie', position_name: 'Chair', is_active: false },
      { branch_id: 'sps', position_name: 'Chair', is_active: true },
    ]
    expect(chairBranchIds(memberships).sort()).toEqual(['cs', 'sps'])
  })

  it('returns empty when the user chairs nothing', () => {
    expect(chairBranchIds([{ branch_id: 'cs', position_name: 'Member' }])).toEqual([])
    expect(chairBranchIds([])).toEqual([])
  })
})
