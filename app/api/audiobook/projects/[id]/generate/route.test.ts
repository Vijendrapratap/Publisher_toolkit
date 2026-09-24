import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/credits/charge', async (orig) => {
  const actual = await orig<typeof import('@/lib/credits/charge')>()
  return { ...actual, chargeCredits: vi.fn(async (_i, fn) => (await fn({ key: 'k' } as never)).result) }
})

vi.mock('@/lib/providers/auth', () => ({
  requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1'),
}))
vi.mock('@/lib/services/audiobook/queries', () => ({
  getAudiobookProjectForPublisher: vi.fn(),
}))
vi.mock('@/lib/services/audiobook/tts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/audiobook/tts')>()),
  synthesizeChapterAudio: vi.fn().mockResolvedValue({
    audioBuffer: Buffer.from('audio'),
    durationSec: 60,
    mimeType: 'audio/mpeg',
    format: 'mp3',
  }),
  concatenateChapters: vi.fn().mockResolvedValue(Buffer.from('full')),
}))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: '/api/files/audiobook/pub_1/proj_1/chapter-1.mp3' }),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    audiobookChapter: { update: vi.fn().mockResolvedValue({}) },
    audiobookProject: { update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}))

import { POST } from './route'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { estimateDuration } from '@/lib/services/audiobook/tts'
import { chargeCredits } from '@/lib/credits/charge'
import { InsufficientCreditsError } from '@/lib/credits/ledger'

const chapter = (n: number, content: string) => ({ id: `ch_${n}`, chapterNumber: n, title: `Chapter ${n}`, content })

const project = {
  id: 'proj_1',
  chapters: [chapter(1, 'word '.repeat(300)), chapter(2, 'word '.repeat(300))],
  audioFormat: 'mp3',
  ttsProvider: 'fishaudio',
  voiceModel: 'warm-literary',
  voicePacing: 1.0,
  sampleAudioUrl: null,
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (id = 'proj_1') =>
  POST(new Request(`http://localhost/api/audiobook/projects/${id}/generate`, { method: 'POST' }), ctx(id))

describe('POST /api/audiobook/projects/:id/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAudiobookProjectForPublisher).mockResolvedValue(project as never)
  })

  it('returns 404 when the project does not exist', async () => {
    vi.mocked(getAudiobookProjectForPublisher).mockResolvedValueOnce(null)
    expect((await post()).status).toBe(404)
  })

  it('returns 400 when the project has no chapters', async () => {
    vi.mocked(getAudiobookProjectForPublisher).mockResolvedValueOnce({ ...project, chapters: [] } as never)
    expect((await post()).status).toBe(400)
  })

  it('synthesizes every chapter and returns the combined track', async () => {
    const res = await post()
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.chaptersCount).toBe(2)
    expect(json.fullAudioUrl).toBeTruthy()
  })

  it('charges credits sized to the estimated narration length', async () => {
    await post()

    const expectedSec = project.chapters.reduce(
      (sum, ch) => sum + estimateDuration(ch.content, project.voicePacing),
      0
    )
    const expectedUnits = Math.max(1, Math.ceil(expectedSec / 600))

    expect(chargeCredits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'pub_1', action: 'audiobook.tts', units: expectedUnits, refId: 'proj_1' }),
      expect.any(Function)
    )
  })

  it('returns 402 when the user cannot afford it', async () => {
    vi.mocked(chargeCredits).mockRejectedValueOnce(new InsufficientCreditsError(1, 0))
    const res = await post()
    expect(res.status).toBe(402)
  })
})
