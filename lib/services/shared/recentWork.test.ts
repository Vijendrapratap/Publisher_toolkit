import { describe, it, expect } from 'vitest'
import { mergeRecentWork } from './recentWork'

const d = (day: number) => new Date(Date.UTC(2026, 9, day))

describe('mergeRecentWork', () => {
  it('mixes both tools newest first, links each to its own tool, and caps the list', () => {
    const items = mergeRecentWork(
      [
        { id: 'ad1', title: 'Ads book', coverUrl: 'c.png', activityAt: d(3) },
        { id: 'ad2', title: 'Older ads', coverUrl: null, activityAt: d(1) },
      ],
      [{ id: 'bk1', title: null, coverImageUrl: null, updatedAt: d(2).toISOString() }],
      2
    )
    expect(items).toEqual([
      { key: 'ads:ad1', kind: 'ads', title: 'Ads book', coverUrl: 'c.png', href: '/ads/books/ad1', updatedAt: d(3) },
      { key: 'book:bk1', kind: 'book', title: 'Untitled book', coverUrl: null, href: '/create-book/bk1', updatedAt: d(2) },
    ])
  })
})
