import { describe, it, expect } from 'vitest'
import { sampleAdCopy } from './sampleCopy'

const book = { title: 'The Lazy Developer', author: 'Jane Coder', blurb: 'A story about shipping less code.' }

describe('sampleAdCopy', () => {
  it('returns one variant per platform, grounded in the book', () => {
    const copy = sampleAdCopy(book)
    expect(copy.map((c) => c.platform)).toEqual(['META', 'GOOGLE', 'AMAZON'])
    for (const c of copy) {
      expect(c.headline.length).toBeGreaterThan(0)
      expect(c.primaryText.length).toBeGreaterThan(0)
      expect(c.description.length).toBeGreaterThan(0)
    }
    expect(copy[2].headline).toContain('The Lazy Developer')
  })

  it('respects platform length limits', () => {
    const copy = sampleAdCopy({ ...book, title: 'A'.repeat(200) })
    expect(copy[0].headline.length).toBeLessThanOrEqual(40)
    expect(copy[0].primaryText.length).toBeLessThanOrEqual(125)
    expect(copy[1].headline.length).toBeLessThanOrEqual(30)
    expect(copy[1].description.length).toBeLessThanOrEqual(90)
  })

  it('changes wording with tone', () => {
    expect(sampleAdCopy(book, 'punchy')[0].headline).not.toBe(sampleAdCopy(book, 'literary')[0].headline)
  })

  it('handles missing metadata', () => {
    const copy = sampleAdCopy({ title: '', author: '', blurb: '' })
    expect(copy[0].headline).toContain('Your next great read')
  })
})
