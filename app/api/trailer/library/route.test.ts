import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_test'),
}))

vi.mock('@/lib/services/trailer/queries', () => ({
  getPublisherTrailerBookLibrary: vi.fn().mockResolvedValue([
    {
      id: 'book_1',
      title: 'Test Book',
      author: 'Test Author',
      blurb: 'Test Blurb',
      frontCoverUrl: 'https://blob.example/cover.png',
      createdAt: new Date(),
      source: 'book',
    },
  ]),
}))

import { GET } from './route'
import { getPublisherTrailerBookLibrary } from '@/lib/services/trailer/queries'

describe('GET /api/trailer/library', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the publisher book library catalog', async () => {
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.books).toHaveLength(1)
    expect(json.books[0].title).toBe('Test Book')
    expect(getPublisherTrailerBookLibrary).toHaveBeenCalledWith('pub_test')
  })
})
