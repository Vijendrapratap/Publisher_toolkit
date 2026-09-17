import { describe, it, expect } from 'vitest'
import { SERVICES, getService } from './registry'

describe('service registry', () => {
  it('lists the four services with unique keys and matching hrefs', () => {
    expect(SERVICES.map((s) => s.key)).toEqual(['ads', 'trailer', 'audiobook', 'landing'])
    for (const s of SERVICES) {
      expect(s.href).toBe(`/${s.key}`)
      expect(s.tintClass).toBe(`bg-tint-${s.key}`)
      expect(s.highlights.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('marks all four services as live', () => {
    expect(SERVICES.filter((s) => s.availability === 'live').map((s) => s.key)).toEqual([
      'ads',
      'trailer',
      'audiobook',
      'landing',
    ])
  })

  it('looks services up by key', () => {
    expect(getService('trailer').name).toBe('Trailer Video')
  })
})
