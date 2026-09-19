import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/providers/storage', () => ({ storeFile: vi.fn().mockResolvedValue({ url: 'https://blob.example/file' }) }))
vi.mock('@/lib/services/ads/extract', () => ({
  extractBookAssets: vi.fn().mockResolvedValue({
    title: 'Test Book',
    author: 'Test Author',
    blurb: 'A blurb',
    frontCoverPng: Buffer.from('png'),
    backCoverPng: Buffer.from('png'),
  }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    book: {
      findFirst: vi.fn(),
    },
    trailerProject: {
      create: vi.fn().mockResolvedValue({ id: 'trailer_1' }),
      findFirst: vi.fn(),
    },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'
import { storeFile } from '@/lib/providers/storage'

describe('POST /api/trailer/projects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a trailer project directly via JSON with sourceUrl and interiorImageUrls', async () => {
    vi.mocked(prisma.trailerProject.create).mockResolvedValueOnce({ id: 'trailer_json_1' } as any)

    const res = await POST(
      new Request('http://localhost/api/trailer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'The Great Story',
          author: 'Author Name',
          blurb: 'A gripping tale',
          sourceUrl: 'https://www.amazon.com/dp/B000TEST',
          interiorImageUrls: ['https://blob.example/page1.png', 'https://blob.example/page2.png'],
          style: 'cinematic',
          length: '30s',
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('trailer_json_1')
    expect(json.isDirect).toBe(true)
    expect(prisma.trailerProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'The Great Story',
          author: 'Author Name',
          blurb: 'A gripping tale',
          sourceUrl: 'https://www.amazon.com/dp/B000TEST',
          interiorImageUrls: ['https://blob.example/page1.png', 'https://blob.example/page2.png'],
          style: 'cinematic',
          length: '30s',
        }),
      })
    )
  })

  it('creates a trailer project via FormData with frontCover and 2 interior page images', async () => {
    vi.mocked(prisma.trailerProject.create).mockResolvedValueOnce({ id: 'trailer_form_1' } as any)

    const coverBlob = new Blob([Buffer.from('cover')], { type: 'image/jpeg' })
    const page1Blob = new Blob([Buffer.from('page1')], { type: 'image/png' })
    const page2Blob = new Blob([Buffer.from('page2')], { type: 'image/png' })

    const form = new FormData()
    form.append('title', 'Direct Trailer Title')
    form.append('author', 'Author')
    form.append('blurb', 'Hook blurb')
    form.append('frontCover', coverBlob, 'cover.jpg')
    form.append('interiorImages', page1Blob, 'page1.png')
    form.append('interiorImages', page2Blob, 'page2.png')
    form.append('style', 'fantasy')

    const res = await POST(
      new Request('http://localhost/api/trailer/projects', {
        method: 'POST',
        body: form,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('trailer_form_1')
    expect(storeFile).toHaveBeenCalledTimes(3) // 1 cover + 2 interior images
    expect(prisma.trailerProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'Direct Trailer Title',
          interiorImageUrls: expect.arrayContaining([
            'https://blob.example/file',
            'https://blob.example/file',
          ]),
          style: 'fantasy',
        }),
      })
    )
  })

  it('creates a trailer project from an existing book in library', async () => {
    vi.mocked(prisma.book.findFirst).mockResolvedValueOnce({
      id: 'existing_book_1',
      publisherId: 'pub_1',
      title: 'Library Book',
      author: 'Library Author',
      blurb: 'Library Blurb',
      pdfUrl: 'https://blob.example/book.pdf',
      frontCoverUrl: 'https://blob.example/cover.png',
      backCoverUrl: null,
      sourceUrl: 'https://amazon.com/dp/B000',
      interiorImageUrls: ['https://blob.example/spread1.png'],
    } as any)

    vi.mocked(prisma.trailerProject.create).mockResolvedValueOnce({ id: 'trailer_from_lib' } as any)

    const res = await POST(
      new Request('http://localhost/api/trailer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingBookId: 'existing_book_1',
          style: 'thriller',
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('trailer_from_lib')
    expect(json.isExisting).toBe(true)
    expect(prisma.trailerProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'Library Book',
          sourceUrl: 'https://amazon.com/dp/B000',
          interiorImageUrls: ['https://blob.example/spread1.png'],
          style: 'thriller',
        }),
      })
    )
  })

  it('returns 400 when neither PDF nor manual details provided', async () => {
    const res = await POST(
      new Request('http://localhost/api/trailer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Please provide a book PDF or enter book details.')
  })
})
