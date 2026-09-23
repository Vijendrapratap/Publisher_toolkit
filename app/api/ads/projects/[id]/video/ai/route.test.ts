import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fallbackBrief } from '@/lib/services/ads/aiVideoBriefSchema'

const book = { id: 'book_1', title: 'T' }
const jobRow = { id: 'job_1', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 0.84, shots: [] }

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/publisher/settings', () => ({ getPublisherAiCredentials: vi.fn() }))
vi.mock('@/lib/providers/ai', () => ({
  resolveApiKey: (c?: { apiKey?: string | null }) => c?.apiKey || undefined,
  getVideoModelName: () => 'kwaivgi/kling-v3.0-std',
}))
vi.mock('@/lib/providers/aiVideo', () => ({ getVideoModelInfo: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({ prisma: { aiVideoJob: { findFirst: vi.fn() } } }))
vi.mock('@/lib/services/ads/aiVideoJob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/ads/aiVideoJob')>()
  return { AiVideoUserError: actual.AiVideoUserError, summarizeJob: actual.summarizeJob, startAiVideoJob: vi.fn(), advanceAiVideoJob: vi.fn() }
})

import { GET, POST, __resetVideoModelInfoCacheForTests } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { getVideoModelInfo } from '@/lib/providers/aiVideo'
import { prisma } from '@/lib/db'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob } from '@/lib/services/ads/aiVideoJob'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const post = (body: unknown) => new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const brief = fallbackBrief({ title: 'T', pageCount: 0 })

beforeEach(() => {
  vi.clearAllMocks()
  __resetVideoModelInfoCacheForTests()
  vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
  vi.mocked(getPublisherAiCredentials).mockResolvedValue({ apiKey: 'sk', model: null })
})

describe('POST /api/ads/projects/:id/video/ai', () => {
  it('starts a job from the edited brief', async () => {
    vi.mocked(startAiVideoJob).mockResolvedValue(jobRow as any)
    const res = await POST(post({ brief }), ctx)
    expect(res.status).toBe(202)
    expect(startAiVideoJob).toHaveBeenCalledWith(book, brief, 'sk')
    expect((await res.json()).job.id).toBe('job_1')
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
    vi.mocked(getPublisherAiCredentials).mockResolvedValue({ apiKey: null, model: null })
    expect((await POST(post({ brief }), ctx)).status).toBe(400)
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
})
