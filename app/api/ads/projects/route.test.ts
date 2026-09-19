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
      create: vi.fn().mockResolvedValue({ id: 'book_1' }),
      findFirst: vi.fn(),
    },
  },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'
import { storeFile } from '@/lib/providers/storage'

function formDataRequest(fields: Record<string, Blob>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new Request('http://localhost/api/ads/projects', { method: 'POST', body: form })
}

describe('POST /api/ads/projects', () => {
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
    const { extractBookAssets } = await import('@/lib/services/ads/extract')
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
    expect(storeFile).toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      manualFrontCoverBytes,
      'image/jpeg'
    )
    expect(storeFile).not.toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      Buffer.from('png'),
      'image/png'
    )
  })

  it('falls back to the manually-supplied front cover when extraction finds no cover', async () => {
    const { extractBookAssets } = await import('@/lib/services/ads/extract')
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
    expect(storeFile).toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      manualFrontCoverBytes,
      'image/jpeg'
    )
  })

  it('rejects a pdf field that is not a File', async () => {
    const form = new FormData()
    form.append('pdf', 'not-a-file')
    const res = await POST(new Request('http://localhost/api/ads/projects', { method: 'POST', body: form }))
    expect(res.status).toBe(400)
    expect(prisma.book.create).not.toHaveBeenCalled()
  })

  it('rejects a pdf over the size limit', async () => {
    const oversized = new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: 'application/pdf' })
    const res = await POST(formDataRequest({ pdf: oversized }))
    expect(res.status).toBe(400)
    expect(prisma.book.create).not.toHaveBeenCalled()
  })

  it('rejects a pdf with a disallowed content type', async () => {
    const notAPdf = new Blob([Buffer.from('plain text')], { type: 'text/plain' })
    const res = await POST(formDataRequest({ pdf: notAPdf }))
    expect(res.status).toBe(400)
    expect(prisma.book.create).not.toHaveBeenCalled()
  })

  it('rejects a cover image with a disallowed content type', async () => {
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const badCover = new Blob([Buffer.from('<svg/>')], { type: 'image/svg+xml' })
    const res = await POST(formDataRequest({ pdf: pdfBlob, frontCover: badCover }))
    expect(res.status).toBe(400)
    expect(prisma.book.create).not.toHaveBeenCalled()
  })

  it('creates a new campaign from an existing book via JSON', async () => {
    vi.mocked(prisma.book.findFirst).mockResolvedValueOnce({
      id: 'existing_book_1',
      publisherId: 'pub_1',
      title: 'Existing Book Title',
      author: 'Author Name',
      blurb: 'Great blurb',
      pdfUrl: 'https://blob/existing.pdf',
      frontCoverUrl: 'https://blob/cover.png',
      backCoverUrl: null,
      parentBookId: null,
      platforms: ['META', 'GOOGLE'],
      copyTone: 'literary',
      templateKey: 'classic',
    } as any)
    vi.mocked(prisma.book.create).mockResolvedValueOnce({ id: 'campaign_project_2' } as any)

    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingBookId: 'existing_book_1',
          campaignName: 'Summer Blitz',
          campaignObjective: 'preorder',
          templateKey: 'fantasy',
          copyTone: 'intriguing',
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('campaign_project_2')
    expect(json.isExisting).toBe(true)
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'Existing Book Title',
          campaignName: 'Summer Blitz',
          campaignObjective: 'preorder',
          templateKey: 'fantasy',
          copyTone: 'intriguing',
          parentBookId: 'existing_book_1',
        }),
      })
    )
  })

  it('returns 404 when existingBookId is not found', async () => {
    vi.mocked(prisma.book.findFirst).mockResolvedValueOnce(null)

    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingBookId: 'missing_id' }),
      })
    )
    expect(res.status).toBe(404)
  })

  it('creates a project directly via JSON without existingBookId', async () => {
    vi.mocked(prisma.book.create).mockResolvedValueOnce({ id: 'direct_json_book_1' } as any)

    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Direct Book Title',
          author: 'Direct Author',
          blurb: 'Direct Blurb',
          campaignName: 'Direct Campaign',
          campaignObjective: 'lead_gen',
          templateKey: 'bold',
          copyTone: 'punchy',
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('direct_json_book_1')
    expect(json.isDirect).toBe(true)
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'Direct Book Title',
          author: 'Direct Author',
          blurb: 'Direct Blurb',
          pdfUrl: null,
          frontCoverUrl: null,
          status: 'uploaded',
          campaignName: 'Direct Campaign',
          campaignObjective: 'lead_gen',
          templateKey: 'bold',
          copyTone: 'punchy',
        }),
      })
    )
  })

  it('creates a project directly via JSON with frontCoverUrl and sets status to configured', async () => {
    vi.mocked(prisma.book.create).mockResolvedValueOnce({ id: 'direct_json_book_2' } as any)

    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontCoverUrl: 'https://blob.example/cover.png',
        }),
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('direct_json_book_2')
    expect(json.isDirect).toBe(true)
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'Untitled Book',
          author: '',
          blurb: '',
          pdfUrl: null,
          frontCoverUrl: 'https://blob.example/cover.png',
          status: 'configured',
        }),
      })
    )
  })

  it('returns 400 via JSON when neither existingBookId nor title/frontCoverUrl is provided', async () => {
    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Please provide a book PDF or enter book details.')
    expect(prisma.book.create).not.toHaveBeenCalled()
  })

  it('creates a project directly via FormData with frontCover and title (no pdf)', async () => {
    vi.mocked(prisma.book.create).mockResolvedValueOnce({ id: 'direct_form_book_1' } as any)

    const manualFrontCoverBytes = Buffer.from('manual-front-cover-bytes')
    const manualFrontCoverBlob = new Blob([manualFrontCoverBytes], { type: 'image/jpeg' })

    const form = new FormData()
    form.append('title', 'Direct Form Title')
    form.append('author', 'Direct Form Author')
    form.append('blurb', 'Direct Form Blurb')
    form.append('frontCover', manualFrontCoverBlob)
    form.append('campaignName', 'Direct Form Campaign')

    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        body: form,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('direct_form_book_1')
    expect(json.needsManualCover).toBe(false)
    expect(json.isDirect).toBe(true)
    expect(storeFile).toHaveBeenCalledWith(
      expect.stringContaining('-front.png'),
      manualFrontCoverBytes,
      'image/jpeg'
    )
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'Direct Form Title',
          author: 'Direct Form Author',
          blurb: 'Direct Form Blurb',
          pdfUrl: null,
          frontCoverUrl: 'https://blob.example/file',
          status: 'configured',
          campaignName: 'Direct Form Campaign',
        }),
      })
    )
  })

  it('creates a project directly via FormData with title only (no pdf, no cover)', async () => {
    vi.mocked(prisma.book.create).mockResolvedValueOnce({ id: 'direct_form_book_2' } as any)

    const form = new FormData()
    form.append('title', 'Direct Form Title Only')

    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        body: form,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('direct_form_book_2')
    expect(json.needsManualCover).toBe(true)
    expect(json.isDirect).toBe(true)
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherId: 'pub_1',
          title: 'Direct Form Title Only',
          pdfUrl: null,
          frontCoverUrl: null,
          status: 'uploaded',
        }),
      })
    )
  })

  it('returns 400 via FormData when neither pdf nor title/manualFrontCover is provided', async () => {
    const form = new FormData()
    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        body: form,
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Please provide a book PDF or enter book details.')
    expect(prisma.book.create).not.toHaveBeenCalled()
  })

  it('returns 400 via FormData when pdf is an empty File (0 bytes) and no manual details', async () => {
    const form = new FormData()
    const emptyPdfBlob = new Blob([], { type: 'application/pdf' })
    form.append('pdf', emptyPdfBlob)

    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        body: form,
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Please provide a book PDF or enter book details.')
    expect(prisma.book.create).not.toHaveBeenCalled()
  })
})
