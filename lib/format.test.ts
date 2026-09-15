import { describe, it, expect } from 'vitest'
import { timeAgo } from './format'

const now = new Date('2026-09-15T12:00:00Z')

describe('timeAgo', () => {
  it('describes recent times in plain words', () => {
    expect(timeAgo(new Date('2026-09-15T11:59:40Z'), now)).toBe('just now')
    expect(timeAgo(new Date('2026-09-15T11:15:00Z'), now)).toBe('45 minutes ago')
    expect(timeAgo(new Date('2026-09-15T09:00:00Z'), now)).toBe('3 hours ago')
    expect(timeAgo(new Date('2026-09-14T12:00:00Z'), now)).toBe('yesterday')
    expect(timeAgo(new Date('2026-09-01T12:00:00Z'), now)).toBe('2 weeks ago')
  })
})
