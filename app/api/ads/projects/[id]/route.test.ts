import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({
  getBookForPublisher: vi.fn().mockResolvedValue({ id: 'book_1', publisherId: 'pub_1' }),
}))
vi.mock('@/lib/blob', () => ({ uploadToBlob: vi.fn().mockResolvedValue({ url: 'https://blob.example/file' }) }))
vi.mock('@/lib/db', () => ({
  prisma: { book: { update: vi.fn().mockResolvedValue({ id: 'book_1' }) } },
}))

import { PATCH } from './route'
import { prisma } from '@/lib/db'
import { uploadToBlob } from '@/lib/blob'
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
    expect(uploadToBlob).toHaveBeenCalledWith(
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
    expect(uploadToBlob).toHaveBeenCalledTimes(1)
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book_1' },
      data: { frontCoverUrl: 'https://blob.example/file' },
    })
  })
})
