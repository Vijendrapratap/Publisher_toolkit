import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: 'https://blob.example/trailer-file' }),
}))
vi.mock('@/lib/services/ads/extract', () => ({
  extractBookAssets: vi.fn().mockResolvedValue({
    title: 'Extracted Trailer Book',
    author: 'Extracted Author',
    blurb: 'Extracted blurb text',
    frontCoverPng: Buffer.from('png-front'),
    backCoverPng: Buffer.from('png-back'),
  }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    trailerProject: {
      create: vi.fn().mockResolvedValue({ id: 'trailer_proj_1' }),
    },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'
import { storeFile } from '@/lib/providers/storage'

function formDataRequest(fields: Record<string, Blob>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new Request('http://localhost/api/trailer/projects', { method: 'POST', body: form })
}

describe('POST /api/trailer/projects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a trailer project from an uploaded PDF with extracted metadata', async () => {
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake pdf')], { type: 'application/pdf' })
    const res = await POST(formDataRequest({ pdf: pdfBlob }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('trailer_proj_1')
    expect(json.needsManualCover).toBe(false)
    expect(prisma.trailerProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'Extracted Trailer Book',
          author: 'Extracted Author',
          status: 'uploaded',
        }),
      })
    )
  })

  it('flags needsManualCover when extraction finds no cover', async () => {
    const { extractBookAssets } = await import('@/lib/services/ads/extract')
    vi.mocked(extractBookAssets).mockResolvedValueOnce({
      title: null,
      author: null,
      blurb: null,
      frontCoverPng: null,
      backCoverPng: null,
    })
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const res = await POST(formDataRequest({ pdf: pdfBlob }))
    const json = await res.json()

    expect(json.needsManualCover).toBe(true)
  })

  it('uses the manually-supplied front cover when provided', async () => {
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const manualCoverBytes = Buffer.from('manual-cover-bytes')
    const manualCoverBlob = new Blob([manualCoverBytes], { type: 'image/jpeg' })

    const res = await POST(formDataRequest({ pdf: pdfBlob, frontCover: manualCoverBlob }))
    const json = await res.json()

    expect(json.needsManualCover).toBe(false)
    expect(storeFile).toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      manualCoverBytes,
      'image/jpeg'
    )
  })

  it('rejects a request missing a PDF file', async () => {
    const form = new FormData()
    form.append('pdf', 'not-a-file')
    const res = await POST(
      new Request('http://localhost/api/trailer/projects', { method: 'POST', body: form })
    )
    expect(res.status).toBe(400)
    expect(prisma.trailerProject.create).not.toHaveBeenCalled()
  })

  it('rejects a non-PDF file', async () => {
    const notAPdf = new Blob([Buffer.from('not pdf content')], { type: 'text/plain' })
    const res = await POST(formDataRequest({ pdf: notAPdf }))
    expect(res.status).toBe(400)
    expect(prisma.trailerProject.create).not.toHaveBeenCalled()
  })
})
