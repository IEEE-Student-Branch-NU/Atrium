import { describe, it, expect } from 'vitest'
import {
  NOTIFICATION_EVENTS,
  renderEvent,
  type NotificationEventKey,
} from '../events'

const KEYS = Object.keys(NOTIFICATION_EVENTS) as NotificationEventKey[]
const VALID_TYPES = ['normal', 'info', 'success', 'warning', 'error']
const VALID_AUDIENCE = ['user', 'branch', 'broadcast']

describe('notification event catalog', () => {
  it('every event has a stable key matching its map key', () => {
    for (const key of KEYS) {
      expect(NOTIFICATION_EVENTS[key].key).toBe(key)
    }
  })

  it('every event declares a valid type, audience, and non-empty channels', () => {
    for (const key of KEYS) {
      const e = NOTIFICATION_EVENTS[key]
      expect(VALID_TYPES).toContain(e.type)
      expect(VALID_AUDIENCE).toContain(e.audience)
      expect(e.channels.length).toBeGreaterThan(0)
      expect(e.channels).toContain('in_app')
    }
  })

  it('renders a non-empty title and message for representative params', () => {
    for (const key of KEYS) {
      const r = renderEvent(key, {
        name: 'Asha',
        branch: 'IEEE CS',
        position: 'Technical Head',
        permission: 'manage_members',
        reason: 'incomplete details',
        event: 'Hack Night',
      })
      expect(r.title.length).toBeGreaterThan(0)
      expect(r.message.length).toBeGreaterThan(0)
      expect(r.event_key).toBe(key)
    }
  })

  it('renders sensibly even with no params (no "undefined"/"null" leaks)', () => {
    for (const key of KEYS) {
      const r = renderEvent(key)
      expect(r.message).not.toMatch(/undefined|null/)
    }
  })



  it('branch-audience events carry a link into a review surface', () => {
    const submitted = renderEvent('position_request.submitted', { name: 'Asha', position: 'Chair' })
    expect(submitted.audience).toBe('branch')
    expect(submitted.link).toBe('/position-requests')
  })
})
