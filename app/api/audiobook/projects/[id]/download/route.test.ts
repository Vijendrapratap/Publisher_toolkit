import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/audiobook/queries', () => ({ getAudiobookProjectForPublisher: vi.fn() }))
vi.mock('@/lib/services/audiobook/zip', () => ({
  buildAudiobookZip: vi.fn().mockResolvedValue(Buffer.from('zip')),
  audiobookZipFileName: vi.fn().mockReturnValue('book.zip'),
}))
vi.mock('@/lib/providers/storage', () => ({ readStoredFile: vi.fn() }))

import { GET } from './route'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/audiobook/projects/:id/download', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getAudiobookProjectForPublisher).mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost'), ctx('proj_99'))
    expect(res.status).toBe(404)
  })
})
