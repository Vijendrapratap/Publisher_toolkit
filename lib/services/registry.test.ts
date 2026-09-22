import { describe, it, expect } from 'vitest'
import { SERVICES, getService } from './registry'

describe('service registry', () => {
  it('lists the active services with unique keys and matching hrefs', () => {
    expect(SERVICES.map((s) => s.key)).toEqual(['create-book', 'ads'])
    for (const s of SERVICES) {
      expect(s.href).toBe(`/${s.key}`)
      expect(s.tintClass).toBe(`bg-tint-${s.key}`)
      expect(s.highlights.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('hides landing and audiobook from the nav but still resolves them', () => {
    expect(SERVICES.every((s) => s.availability === 'live')).toBe(true)
    expect(getService('landing').key).toBe('landing')
    expect(getService('audiobook').key).toBe('audiobook')
  })

  it('looks services up by key', () => {
    expect(getService('create-book').name).toBe('Create Your Book')
    expect(getService('trailer').name).toBe('Trailer Video')
  })
})
