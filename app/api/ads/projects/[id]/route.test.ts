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
import { defaultVideoSpec, presetStyle } from '@/lib/services/ads/videoSpec'

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

  it('saves an edited video spec', async () => {
    const spec = defaultVideoSpec({ title: 'T' })
    const res = await PATCH(jsonRequest({ videoSpec: spec }), ctx('book_1'))
    expect(res.status).toBe(200)
    expect(prisma.book.update).toHaveBeenCalledWith({ where: { id: 'book_1' }, data: { videoSpec: spec } })
  })

  it('rejects a video spec with an invalid colour', async () => {
    const spec = defaultVideoSpec({ title: 'T' })
    spec.style.colors.accent = 'red'
    const res = await PATCH(jsonRequest({ videoSpec: spec }), ctx('book_1'))
    expect(res.status).toBe(400)
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('accepts every length the configure form offers', async () => {
    const res = await PATCH(jsonRequest({ videoLength: '20s' }), ctx('book_1'))
    expect(res.status).toBe(200)
  })

  describe('re-deriving a saved videoSpec from configure-page fields', () => {
    const savedSpec = defaultVideoSpec({ title: 'T' })

    it('merges a changed format into the saved spec, alongside the column', async () => {
      vi.mocked(getBookForPublisher).mockResolvedValueOnce({ id: 'book_1', publisherId: 'pub_1', videoSpec: savedSpec } as any)
      const res = await PATCH(jsonRequest({ videoFormat: '9:16' }), ctx('book_1'))
      expect(res.status).toBe(200)
      const call = vi.mocked(prisma.book.update).mock.calls[0][0] as any
      expect(call.data.videoFormat).toBe('9:16')
      expect(call.data.videoSpec).toMatchObject({ ...savedSpec, format: '9:16' })
    })

    it('maps style/hook/cta onto the preset palette and script, clipped to the spec limits', async () => {
      vi.mocked(getBookForPublisher).mockResolvedValueOnce({ id: 'book_1', publisherId: 'pub_1', videoSpec: savedSpec } as any)
      const res = await PATCH(jsonRequest({ videoStyle: 'fantasy', customHook: 'A brand new hook', ctaText: 'Buy now' }), ctx('book_1'))
      expect(res.status).toBe(200)
      const call = vi.mocked(prisma.book.update).mock.calls[0][0] as any
      expect(call.data.videoSpec.style).toEqual(presetStyle('fantasy'))
      expect(call.data.videoSpec.script.hook).toBe('A brand new hook')
      expect(call.data.videoSpec.script.cta).toBe('Buy now')
      // Untouched script fields survive the merge.
      expect(call.data.videoSpec.script.storyLine).toBe(savedSpec.script.storyLine)
    })

    it('ignores an empty customHook/ctaText rather than blanking the saved script', async () => {
      vi.mocked(getBookForPublisher).mockResolvedValueOnce({ id: 'book_1', publisherId: 'pub_1', videoSpec: savedSpec } as any)
      const res = await PATCH(jsonRequest({ customHook: '', ctaText: '' }), ctx('book_1'))
      expect(res.status).toBe(200)
      const call = vi.mocked(prisma.book.update).mock.calls[0][0] as any
      expect(call.data.videoSpec.script.hook).toBe(savedSpec.script.hook)
      expect(call.data.videoSpec.script.cta).toBe(savedSpec.script.cta)
    })

    it('leaves the spec untouched when the update has no video fields', async () => {
      vi.mocked(getBookForPublisher).mockResolvedValueOnce({ id: 'book_1', publisherId: 'pub_1', videoSpec: savedSpec } as any)
      const res = await PATCH(jsonRequest({ title: 'New title' }), ctx('book_1'))
      expect(res.status).toBe(200)
      const call = vi.mocked(prisma.book.update).mock.calls[0][0] as any
      expect(call.data).not.toHaveProperty('videoSpec')
    })

    it('does not touch the spec when the book has none saved yet', async () => {
      vi.mocked(getBookForPublisher).mockResolvedValueOnce({ id: 'book_1', publisherId: 'pub_1', videoSpec: null } as any)
      const res = await PATCH(jsonRequest({ videoFormat: '9:16' }), ctx('book_1'))
      expect(res.status).toBe(200)
      const call = vi.mocked(prisma.book.update).mock.calls[0][0] as any
      expect(call.data).not.toHaveProperty('videoSpec')
    })

    it('does not re-derive when the update already sends its own videoSpec', async () => {
      vi.mocked(getBookForPublisher).mockResolvedValueOnce({ id: 'book_1', publisherId: 'pub_1', videoSpec: savedSpec } as any)
      const explicitSpec = { ...savedSpec, format: '1:1' as const }
      const res = await PATCH(jsonRequest({ videoFormat: '9:16', videoSpec: explicitSpec }), ctx('book_1'))
      expect(res.status).toBe(200)
      const call = vi.mocked(prisma.book.update).mock.calls[0][0] as any
      expect(call.data.videoSpec).toEqual(explicitSpec)
    })
  })

  describe('uploaded music ownership', () => {
    it('rejects a video spec whose uploaded music does not belong to this publisher', async () => {
      const spec = defaultVideoSpec({ title: 'T' })
      spec.music = { kind: 'upload', url: '/api/files/ads/someone-else/music/track.mp3', name: 'track.mp3' }
      const res = await PATCH(jsonRequest({ videoSpec: spec }), ctx('book_1'))
      expect(res.status).toBe(400)
      expect(prisma.book.update).not.toHaveBeenCalled()
    })

    it('accepts uploaded music that does belong to this publisher', async () => {
      const spec = defaultVideoSpec({ title: 'T' })
      spec.music = { kind: 'upload', url: '/api/files/ads/pub_1/music/track.mp3', name: 'track.mp3' }
      const res = await PATCH(jsonRequest({ videoSpec: spec }), ctx('book_1'))
      expect(res.status).toBe(200)
    })
  })
})
