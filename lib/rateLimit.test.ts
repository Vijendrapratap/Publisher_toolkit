import { describe, expect, it } from 'vitest'
import { rateLimited } from './rateLimit'

describe('rateLimited', () => {
  it('allows `limit` hits per window, then refuses until the window passes', () => {
    const key = `t_${Math.random()}`
    expect(rateLimited(key, 2, 1000, 0)).toBe(false)
    expect(rateLimited(key, 2, 1000, 10)).toBe(false)
    expect(rateLimited(key, 2, 1000, 20)).toBe(true)
    expect(rateLimited(key, 2, 1000, 1001)).toBe(false)
  })
})
