import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({
  getBookForPublisher: vi.fn().mockResolvedValue({ id: 'book_1', publisherId: 'pub_1' }),
}))
vi.mock('@/lib/providers/storage', () => ({ storeFile: vi.fn().mockResolvedValue({ url: 'https://blob.example/file' }) }))
vi.mock('@/lib/db', () => ({
  prisma: { book: { update: vi.fn().mockResolvedValue({ id: 'book_1' }) } },
}))

import { PATCH } from './route'
import { prisma } from '@/lib/db'
import { storeFile } from '@/lib/providers/storage'
import { getBookForPublisher } from '@/lib/services/ads/queries'

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

function formDataRequest(fields: Record<string, Blob>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new Request('http://localhost/api/ads/projects/book_1', { method: 'PATCH', body: form })
}

describe('PATCH /api/ads/projects/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uploads a front cover and updates the book', async () => {
    const frontCover = new Blob([Buffer.from('front-bytes')], { type: 'image/png' })
    const res = await PATCH(formDataRequest({ frontCover }), ctx('book_1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('book_1')
    expect(storeFile).toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      Buffer.from('front-bytes'),
      'image/png'
    )
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      data: { frontCoverUrl: 'https://blob.example/file' },
    })
  })

  it('returns 404 when the book does not belong to the caller', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    const frontCover = new Blob([Buffer.from('front-bytes')], { type: 'image/png' })
    const res = await PATCH(formDataRequest({ frontCover }), ctx('book_1'))
    expect(res.status).toBe(404)
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('rejects a disallowed cover content type', async () => {
    const frontCover = new Blob([Buffer.from('<svg/>')], { type: 'image/svg+xml' })
    const res = await PATCH(formDataRequest({ frontCover }), ctx('book_1'))
    expect(res.status).toBe(400)
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('rejects when neither cover is provided', async () => {
    const res = await PATCH(formDataRequest({}), ctx('book_1'))
    expect(res.status).toBe(400)
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('rejects an oversized cover', async () => {
    const oversized = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' })
    const res = await PATCH(formDataRequest({ frontCover: oversized }), ctx('book_1'))
    expect(res.status).toBe(400)
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('treats an unselected file input (zero-byte, application/octet-stream) as absent, not a validation failure', async () => {
    // Browsers submit an <input type="file"> with nothing chosen as a zero-byte File
    // with type application/octet-stream, not as a missing field.
    const frontCover = new Blob([Buffer.from('front-bytes')], { type: 'image/png' })
    const backCover = new Blob([], { type: 'application/octet-stream' })
    const res = await PATCH(formDataRequest({ frontCover, backCover }), ctx('book_1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('book_1')
    expect(storeFile).toHaveBeenCalledTimes(1)
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      data: { frontCoverUrl: 'https://blob.example/file' },
    })
  })

  function jsonRequest(body: unknown) {
    return new Request('http://localhost/api/ads/projects/book_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('updates edited book details from JSON', async () => {
    const res = await PATCH(jsonRequest({ title: 'Better Title', blurb: 'New blurb' }), ctx('book_1'))
    expect(res.status).toBe(200)
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      data: { title: 'Better Title', blurb: 'New blurb' },
    })
  })

  it('saves a full configuration and marks the project configured', async () => {
    const res = await PATCH(jsonRequest({ platforms: ['META', 'GOOGLE'], copyTone: 'punchy', templateKey: 'bold' }), ctx('book_1'))
    expect(res.status).toBe(200)
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      data: { platforms: ['META', 'GOOGLE'], copyTone: 'punchy', templateKey: 'bold', status: 'configured' },
    })
  })

  it('rejects an invalid configuration with a readable error', async () => {
    const res = await PATCH(jsonRequest({ platforms: [] }), ctx('book_1'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Choose at least one platform')
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const req = new Request('http://localhost/api/ads/projects/book_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    expect((await PATCH(req, ctx('book_1'))).status).toBe(400)
  })
})
