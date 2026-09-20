import { describe, it, expect } from 'vitest'
import { dedupeByTitle, type LibraryRow } from './library'

const row = (over: Partial<LibraryRow> & { id: string }): LibraryRow => ({
  title: 'Shadows of the Forgotten',
  author: 'K. L. Vance',
  blurb: 'A blurb.',
  frontCoverUrl: null,
  createdAt: new Date('2026-01-01'),
  ...over,
})

describe('dedupeByTitle', () => {
  it('collapses repeated campaigns for one book into a single entry', () => {
    const entries = dedupeByTitle([
      { rows: [row({ id: 'b3' }), row({ id: 'b2' }), row({ id: 'b1' })], source: 'book' },
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0].campaignCount).toBe(3)
    // Rows arrive newest-first, so a new campaign branches off the latest one.
    expect(entries[0].id).toBe('b3')
  })

  it('matches titles regardless of case and surrounding space', () => {
    const entries = dedupeByTitle([
      { rows: [row({ id: 'b1', title: 'Starfall' }), row({ id: 'b2', title: '  starfall ' })], source: 'book' },
    ])
    expect(entries).toHaveLength(1)
  })

  it('keeps an untitled row distinct instead of merging every untitled book', () => {
    const entries = dedupeByTitle([
      { rows: [row({ id: 'b1', title: null }), row({ id: 'b2', title: null })], source: 'book' },
    ])
    expect(entries.map((e) => e.id)).toEqual(['b1', 'b2'])
    expect(entries[0].title).toBe('Untitled book')
  })

  it('adopts a cover from a later duplicate when the newest row has none', () => {
    const entries = dedupeByTitle([
      { rows: [row({ id: 'b2' }), row({ id: 'b1', frontCoverUrl: '/cover.png' })], source: 'book' },
    ])
    expect(entries[0].frontCoverUrl).toBe('/cover.png')
  })

  it('merges across sources and records where each entry came from', () => {
    const entries = dedupeByTitle([
      { rows: [row({ id: 'b1', title: 'Starfall' })], source: 'book' },
      { rows: [row({ id: 't1', title: 'Starfall' }), row({ id: 't2', title: 'Other' })], source: 'trailer' },
    ])

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ id: 'b1', source: 'book', campaignCount: 2 })
    expect(entries[1]).toMatchObject({ id: 't2', source: 'trailer' })
  })
})
