import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fallbackBrief } from '@/lib/services/ads/aiVideoBriefSchema'

const book = { id: 'book_1', title: 'T' }
const jobRow = { id: 'job_1', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 0.84, shots: [] }

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/providers/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/providers/ai')>()
  return { ...actual, getVideoModelName: () => 'kwaivgi/kling-v3.0-std' }
})
vi.mock('@/lib/providers/aiVideo', () => ({ getVideoModelInfo: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({ prisma: { aiVideoJob: { findFirst: vi.fn() } } }))
vi.mock('@/lib/services/ads/aiVideoJob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/ads/aiVideoJob')>()
  return { AiVideoUserError: actual.AiVideoUserError, summarizeJob: actual.summarizeJob, startAiVideoJob: vi.fn(), advanceAiVideoJob: vi.fn() }
})
vi.mock('@/lib/credits/ledger', () => ({ reserveCredits: vi.fn(), settleReservation: vi.fn(), refundReservation: vi.fn() }))

import { GET, POST, __resetVideoModelInfoCacheForTests } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { getVideoModelInfo } from '@/lib/providers/aiVideo'
import { prisma } from '@/lib/db'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob } from '@/lib/services/ads/aiVideoJob'
import { reserveCredits, refundReservation, settleReservation } from '@/lib/credits/ledger'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const post = (body: unknown) => new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const brief = fallbackBrief({ title: 'T', pageCount: 0 })
const twoShotBrief = {
  shots: [
    { prompt: 'Slow push-in on the cover, dust drifting in soft light', sourceImage: 'cover', durationSec: 5, caption: '' },
    { prompt: 'Gentle parallax drift across the first page, warm light', sourceImage: 'page-1', durationSec: 5, caption: '' },
  ],
  endCard: { headline: 'Read it', cta: 'Buy now' },
}

// The route runs on the platform key only, read straight from the env var.
let prevApiKey: string | undefined

beforeEach(() => {
  vi.clearAllMocks()
  __resetVideoModelInfoCacheForTests()
  vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
  prevApiKey = process.env.OPENROUTER_API_KEY
  process.env.OPENROUTER_API_KEY = 'sk'
})

afterEach(() => {
  if (prevApiKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = prevApiKey
})

describe('POST /api/ads/projects/:id/video/ai', () => {
  it('starts a job from the edited brief', async () => {
    vi.mocked(startAiVideoJob).mockResolvedValue(jobRow as any)
    const res = await POST(post({ brief }), ctx)
    expect(res.status).toBe(202)
    expect(startAiVideoJob).toHaveBeenCalledWith(book, brief, 'sk', expect.any(String))
    expect((await res.json()).job.id).toBe('job_1')
  })
  it('reserves credits for every 5s block before starting, keyed by the job id', async () => {
    vi.mocked(startAiVideoJob).mockResolvedValue(jobRow as any)
    const res = await POST(post({ brief: twoShotBrief }), ctx)
    expect(res.status).toBe(202)
    const call = vi.mocked(reserveCredits).mock.calls[0][0]
    expect(call).toMatchObject({ userId: 'pub_1', action: 'ads.video.ai', units: 2 })
    expect(call.key).toBe(`video:${vi.mocked(startAiVideoJob).mock.calls[0][3]}`)
  })
  it('refunds when the job cannot be started', async () => {
    vi.mocked(startAiVideoJob).mockRejectedValueOnce(new AiVideoUserError('already running'))
    const res = await POST(post({ brief: twoShotBrief }), ctx)
    expect(res.status).toBe(400)
    expect(refundReservation).toHaveBeenCalledWith(vi.mocked(reserveCredits).mock.calls[0][0].key)
  })
  it('still returns the original error when the refund itself throws', async () => {
    vi.mocked(startAiVideoJob).mockRejectedValueOnce(new AiVideoUserError('already running'))
    vi.mocked(refundReservation).mockRejectedValueOnce(new Error('db blip'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(post({ brief: twoShotBrief }), ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('already running')
    errorSpy.mockRestore()
  })
  it('explains fixable problems as 400s', async () => {
    vi.mocked(startAiVideoJob).mockRejectedValue(new AiVideoUserError("can't make 1:1 videos"))
    const res = await POST(post({ brief }), ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/1:1/)
  })
  it('logs an unexpected failure server-side and returns a safe 500 message', async () => {
    vi.mocked(startAiVideoJob).mockRejectedValue(new Error('ENOENT: chrome-headless-shell not installed'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(post({ brief }), ctx)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('The AI video could not be started. Please try again.')
    expect(body.error).not.toMatch(/remotion|ffmpeg|chrome|ENOENT/i)
    expect(errorSpy).toHaveBeenCalledWith('ai video start failed', expect.any(Error))
    errorSpy.mockRestore()
  })
  it('rejects an invalid brief and a missing key', async () => {
    expect((await POST(post({ brief: { shots: [] } }), ctx)).status).toBe(400)
    delete process.env.OPENROUTER_API_KEY
    expect((await POST(post({ brief }), ctx)).status).toBe(400)
  })

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await POST(post({ brief }), ctx)).status).toBe(404)
  })
})

describe('GET /api/ads/projects/:id/video/ai', () => {
  it('advances and returns the latest job', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(jobRow as any)
    vi.mocked(advanceAiVideoJob).mockResolvedValue({ ...jobRow, status: 'completed', videoUrl: '/v.mp4' } as any)
    const res = await GET(new Request('http://localhost'), ctx)
    const body = await res.json()
    expect(body.aiConfigured).toBe(true)
    expect(body.job).toMatchObject({ id: 'job_1', status: 'completed', videoUrl: '/v.mp4' })
  })
  it('returns no job when none exists', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(null)
    expect((await (await GET(new Request('http://localhost'), ctx)).json()).job).toBeNull()
  })

  it('returns the stored job instead of a 500 when advancing it throws', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(jobRow as any)
    vi.mocked(advanceAiVideoJob).mockRejectedValue(new Error('OpenRouter is unreachable'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(new Request('http://localhost'), ctx)
    expect(res.status).toBe(200)
    expect((await res.json()).job).toMatchObject({ id: 'job_1', status: 'running' })
    errorSpy.mockRestore()
  })

  it('does not 500 when the model info lookup fails', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(null)
    vi.mocked(getVideoModelInfo).mockRejectedValueOnce(new Error('network blip'))
    const res = await GET(new Request('http://localhost'), ctx)
    expect(res.status).toBe(200)
    expect((await res.json()).model).toBeNull()
  })

  it('caches the model lookup for 5 minutes instead of calling OpenRouter on every poll', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(null)
    vi.mocked(getVideoModelInfo).mockResolvedValue({
      id: 'kwaivgi/kling-v3.0-std', durations: [5], aspectRatios: ['16:9'], resolutions: ['720p'], pricePerSecond: 0.084,
    })
    await GET(new Request('http://localhost'), ctx)
    await GET(new Request('http://localhost'), ctx)
    await GET(new Request('http://localhost'), ctx)
    expect(getVideoModelInfo).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed model lookup — the very next call retries it', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(null)
    vi.mocked(getVideoModelInfo)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ id: 'kwaivgi/kling-v3.0-std', durations: [5], aspectRatios: ['16:9'], resolutions: ['720p'], pricePerSecond: 0.084 })
    const first = await GET(new Request('http://localhost'), ctx)
    expect((await first.json()).model).toBeNull()

    const second = await GET(new Request('http://localhost'), ctx)
    expect((await second.json()).model).toMatchObject({ id: 'kwaivgi/kling-v3.0-std' })
    expect(getVideoModelInfo).toHaveBeenCalledTimes(2)
  })

  it('looks the model up again once the cache entry expires', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(null)
      vi.mocked(getVideoModelInfo).mockResolvedValue({
        id: 'kwaivgi/kling-v3.0-std', durations: [5], aspectRatios: ['16:9'], resolutions: ['720p'], pricePerSecond: 0.084,
      })
      await GET(new Request('http://localhost'), ctx)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1)
      await GET(new Request('http://localhost'), ctx)
      expect(getVideoModelInfo).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('settles a completed job and refunds a failed one on poll', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(jobRow as any)
    vi.mocked(advanceAiVideoJob).mockResolvedValueOnce({ ...jobRow, id: 'j1', status: 'completed', costUsd: 0.84 } as any)
    await GET(new Request('http://localhost'), ctx)
    expect(settleReservation).toHaveBeenCalledWith('video:j1', { costUsd: 0.84 })

    vi.mocked(advanceAiVideoJob).mockResolvedValueOnce({ ...jobRow, id: 'j2', status: 'failed' } as any)
    await GET(new Request('http://localhost'), ctx)
    expect(refundReservation).toHaveBeenCalledWith('video:j2')
  })

  it('does not break the poll response when settling credits throws', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(jobRow as any)
    vi.mocked(advanceAiVideoJob).mockResolvedValueOnce({ ...jobRow, id: 'j3', status: 'completed', costUsd: 0.5 } as any)
    vi.mocked(settleReservation).mockRejectedValueOnce(new Error('db blip'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(new Request('http://localhost'), ctx)
    expect(res.status).toBe(200)
    expect((await res.json()).job).toMatchObject({ id: 'j3', status: 'completed' })
    errorSpy.mockRestore()
  })

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost'), ctx)
    expect(res.status).toBe(404)
  })
})
