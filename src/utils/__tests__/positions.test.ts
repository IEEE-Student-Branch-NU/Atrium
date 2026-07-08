import { describe, it, expect } from 'vitest'
import { isLeadershipPosition, classifyMembers } from '@/utils/positions'

describe('isLeadershipPosition', () => {
  it('matches leadership titles case-insensitively', () => {
    expect(isLeadershipPosition('Chair')).toBe(true)
    expect(isLeadershipPosition('  technical head ')).toBe(true)
  })
  it('rejects associate/general titles and null', () => {
    expect(isLeadershipPosition('Technical Associate')).toBe(false)
    expect(isLeadershipPosition(null)).toBe(false)
  })
})

describe('classifyMembers', () => {
  it('splits members into exec and associates', () => {
    const r = classifyMembers([
      { position_name: 'Chair' },
      { position_name: 'Technical Associate' },
      { position_name: null },
    ])
    expect(r.exec).toHaveLength(1)
    expect(r.associates).toHaveLength(2)
  })
})
