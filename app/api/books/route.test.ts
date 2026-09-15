import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/blob', () => ({ uploadToBlob: vi.fn().mockResolvedValue({ url: 'https://blob.example/file' }) }))
vi.mock('@/lib/pdf/extract', () => ({
  extractBookAssets: vi.fn().mockResolvedValue({
    title: 'Test Book',
    author: 'Test Author',
    blurb: 'A blurb',
    frontCoverPng: Buffer.from('png'),
    backCoverPng: Buffer.from('png'),
  }),
}))
vi.mock('@/lib/db', () => ({
  prisma: { book: { create: vi.fn().mockResolvedValue({ id: 'book_1' }) } },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'
import { uploadToBlob } from '@/lib/blob'

function formDataRequest(fields: Record<string, Blob>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new Request('http://localhost/api/books', { method: 'POST', body: form })
}

describe('POST /api/books', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a book from an uploaded PDF with extracted metadata', async () => {
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const res = await POST(formDataRequest({ pdf: pdfBlob }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('book_1')
    expect(json.needsManualCover).toBe(false)
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publisherId: 'pub_1', title: 'Test Book' }),
      })
    )
  })

  it('flags needsManualCover when extraction finds no cover', async () => {
    const { extractBookAssets } = await import('@/lib/pdf/extract')
    vi.mocked(extractBookAssets).mockResolvedValueOnce({
      title: null, author: null, blurb: null, frontCoverPng: null, backCoverPng: null,
    })
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const res = await POST(formDataRequest({ pdf: pdfBlob }))
    const json = await res.json()

    expect(json.needsManualCover).toBe(true)
  })

  it('uses the manually-supplied front cover instead of the extracted PNG when both are present', async () => {
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const manualFrontCoverBytes = Buffer.from('manual-front-cover-bytes')
    const manualFrontCoverBlob = new Blob([manualFrontCoverBytes], { type: 'image/jpeg' })

    const res = await POST(
      formDataRequest({ pdf: pdfBlob, frontCover: manualFrontCoverBlob })
    )
    const json = await res.json()

    expect(json.needsManualCover).toBe(false)
    expect(uploadToBlob).toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      manualFrontCoverBytes,
      'image/jpeg'
    )
    expect(uploadToBlob).not.toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      Buffer.from('png'),
      'image/png'
    )
  })

  it('falls back to the manually-supplied front cover when extraction finds no cover', async () => {
    const { extractBookAssets } = await import('@/lib/pdf/extract')
    vi.mocked(extractBookAssets).mockResolvedValueOnce({
      title: null, author: null, blurb: null, frontCoverPng: null, backCoverPng: null,
    })

    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const manualFrontCoverBytes = Buffer.from('manual-front-cover-bytes')
    const manualFrontCoverBlob = new Blob([manualFrontCoverBytes], { type: 'image/jpeg' })

    const res = await POST(
      formDataRequest({ pdf: pdfBlob, frontCover: manualFrontCoverBlob })
    )
    const json = await res.json()

    expect(json.needsManualCover).toBe(false)
    expect(uploadToBlob).toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      manualFrontCoverBytes,
      'image/jpeg'
    )
  })
})
