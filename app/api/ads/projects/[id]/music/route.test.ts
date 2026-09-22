import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/providers/storage', () => ({ storeFile: vi.fn(async (p: string) => ({ url: `/api/files/${p}` })) }))

import { POST } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { storeFile } from '@/lib/providers/storage'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const upload = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://localhost', { method: 'POST', body: form })
}

describe('POST /api/ads/projects/:id/music', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue({ id: 'book_1' } as any)
  })

  it('stores an MP3 under the publisher and returns its URL and name', async () => {
    const res = await POST(upload(new File([Buffer.from('ID3')], 'Theme Song.mp3', { type: 'audio/mpeg' })), ctx)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Theme Song.mp3')
    expect(body.url).toMatch(/^\/api\/files\/ads\/pub_1\/music\/.+-track\.mp3$/)
    expect(storeFile).toHaveBeenCalledWith(expect.stringMatching(/^ads\/pub_1\/music\//), expect.any(Buffer), 'audio/mpeg')
  })

  it('rejects files that are not audio', async () => {
    const res = await POST(upload(new File(['x'], 'notes.txt', { type: 'text/plain' })), ctx)
    expect(res.status).toBe(400)
    expect(storeFile).not.toHaveBeenCalled()
  })

  it('rejects files over 15 MB', async () => {
    const big = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'long.mp3', { type: 'audio/mpeg' })
    expect((await POST(upload(big), ctx)).status).toBe(400)
  })
})
