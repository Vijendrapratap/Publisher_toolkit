import { describe, it, expect } from 'vitest'
import { SERVICES, getService } from './registry'

describe('service registry', () => {
  it('lists the active services with unique keys and matching hrefs', () => {
    expect(SERVICES.map((s) => s.key)).toEqual(['create-book', 'ads', 'landing', 'audiobook'])
    for (const s of SERVICES) {
      expect(s.href).toBe(`/${s.key}`)
      expect(s.tintClass).toBe(`bg-tint-${s.key}`)
      expect(s.highlights.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('marks create-book, ads, and landing as live, and audiobook as coming-soon', () => {
    expect(SERVICES.filter((s) => s.availability === 'live').map((s) => s.key)).toEqual([
      'create-book',
      'ads',
      'landing',
    ])
    expect(getService('audiobook').availability).toBe('coming-soon')
  })

  it('looks services up by key', () => {
    expect(getService('create-book').name).toBe('Create Your Book')
    expect(getService('trailer').name).toBe('Trailer Video')
  })
})
