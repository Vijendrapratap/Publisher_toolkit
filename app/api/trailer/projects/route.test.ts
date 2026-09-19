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
    book: {
      findFirst: vi.fn(),
    },
    trailerProject: {
      create: vi.fn().mockResolvedValue({ id: 'trailer_proj_1' }),
      findFirst: vi.fn(),
    },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'
import { storeFile } from '@/lib/providers/storage'

function formDataRequest(fields: Record<string, Blob | string>) {
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

  it('uses the manually-supplied front cover when provided with PDF', async () => {
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

  it('creates a trailer project from an existing book in library (JSON)', async () => {
    vi.mocked(prisma.book.findFirst).mockResolvedValueOnce({
      id: 'book_123',
      publisherId: 'pub_1',
      title: 'Existing Library Book',
      author: 'Jane Author',
      blurb: 'Great synopsis',
      pdfUrl: 'https://blob.example/existing.pdf',
      frontCoverUrl: 'https://blob.example/front.png',
      backCoverUrl: null,
      status: 'configured',
      platforms: ['META'],
      copyTone: 'literary',
      templateKey: 'classic',
      campaignName: 'Test',
      campaignObjective: 'launch',
      targetAudience: null,
      customHook: null,
      ctaText: 'Buy',
      parentBookId: null,
      includeVideo: true,
      videoFormat: '16:9',
      videoStyle: 'cinematic',
      videoMood: 'epic',
      videoLength: '30s',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await POST(
      new Request('http://localhost/api/trailer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingBookId: 'book_123', style: 'thriller' }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('trailer_proj_1')
    expect(json.isExisting).toBe(true)
    expect(json.needsManualCover).toBe(false)
    expect(prisma.trailerProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Existing Library Book',
          author: 'Jane Author',
          blurb: 'Great synopsis',
          frontCoverUrl: 'https://blob.example/front.png',
          style: 'thriller',
          status: 'configured',
        }),
      })
    )
  })

  it('creates a trailer project via Quick Setup (No PDF) via JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/trailer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Manual Book Title',
          author: 'Manual Author',
          blurb: 'Quick blurb',
          frontCoverUrl: 'https://blob.example/manual-front.png',
          style: 'fantasy',
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('trailer_proj_1')
    expect(json.isDirect).toBe(true)
    expect(json.needsManualCover).toBe(false)
    expect(prisma.trailerProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Manual Book Title',
          author: 'Manual Author',
          blurb: 'Quick blurb',
          style: 'fantasy',
          status: 'configured',
        }),
      })
    )
  })

  it('creates a trailer project via Quick Setup (No PDF) via FormData with cover file', async () => {
    const manualCoverBytes = Buffer.from('cover-bytes-for-quick')
    const manualCoverBlob = new Blob([manualCoverBytes], { type: 'image/png' })

    const res = await POST(
      formDataRequest({
        title: 'Quick Setup Form Book',
        author: 'Quick Author',
        blurb: 'Exciting blurb',
        frontCover: manualCoverBlob,
        style: 'scifi',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('trailer_proj_1')
    expect(json.isDirect).toBe(true)
    expect(json.needsManualCover).toBe(false)
    expect(prisma.trailerProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Quick Setup Form Book',
          author: 'Quick Author',
          style: 'scifi',
          status: 'configured',
        }),
      })
    )
  })

  it('rejects a request missing a PDF file when no manual details are provided', async () => {
    const form = new FormData()
    form.append('pdf', 'not-a-file')
    const res = await POST(
      new Request('http://localhost/api/trailer/projects', { method: 'POST', body: form })
    )
    expect(res.status).toBe(400)
    expect(prisma.trailerProject.create).not.toHaveBeenCalled()
  })

  it('rejects a non-PDF file when pdf field is provided', async () => {
    const notAPdf = new Blob([Buffer.from('not pdf content')], { type: 'text/plain' })
    const res = await POST(formDataRequest({ pdf: notAPdf }))
    expect(res.status).toBe(400)
    expect(prisma.trailerProject.create).not.toHaveBeenCalled()
  })

  it('rejects when neither PDF nor title nor cover is given', async () => {
    const res = await POST(
      new Request('http://localhost/api/trailer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    )
    expect(res.status).toBe(400)
  })
})
