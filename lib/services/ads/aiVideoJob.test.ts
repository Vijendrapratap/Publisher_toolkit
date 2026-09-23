import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiVideoBrief } from './aiVideoBriefSchema'

vi.mock('@/lib/db', () => ({
  prisma: {
    aiVideoJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(async ({ data }: any) => ({ id: 'job_1', status: 'running', videoUrl: null, posterUrl: null, error: null, ...data })),
      update: vi.fn(async ({ data }: any) => ({ id: 'job_1', ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    book: { update: vi.fn(async () => ({})) },
  },
}))
vi.mock('@/lib/providers/aiVideo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/providers/aiVideo')>()),
  getVideoModelInfo: vi.fn(),
  submitVideoJob: vi.fn(),
  getVideoJob: vi.fn(),
  downloadVideoJob: vi.fn(),
}))
vi.mock('@/lib/providers/ai', () => ({ getVideoModelName: () => 'kwaivgi/kling-v3.0-std' }))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn(async (p: string) => ({ url: `/api/files/${p}` })),
  readStoredFile: vi.fn(async () => ({ data: Buffer.from('clip'), contentType: 'video/mp4' })),
}))
vi.mock('./videoAssets', () => ({
  inlineImage: vi.fn(async (u: string | null) => (u ? `data:${u}` : null)),
  musicFile: vi.fn(async () => '/app/public/music/epic.mp3'),
}))
vi.mock('./renderVideo', () => ({
  renderStillPng: vi.fn(async () => Buffer.from('png')),
  renderAdVideo: vi.fn(async () => ({ videoBuffer: Buffer.from('end'), posterBuffer: Buffer.from('poster'), durationSec: 3, width: 1920, height: 1080 })),
}))
vi.mock('./aiVideoStitch', () => ({ stitchAiVideo: vi.fn(async () => {}), probeDuration: vi.fn(async () => 5) }))
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: vi.fn(async () => Buffer.from('final')),
}))

import { prisma } from '@/lib/db'
import { getVideoJob, getVideoModelInfo, submitVideoJob, downloadVideoJob } from '@/lib/providers/aiVideo'
import { stitchAiVideo } from './aiVideoStitch'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob, summarizeJob } from './aiVideoJob'

const book: any = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: '/cover.png', interiorImageUrls: ['/p1.png'],
  customHook: null, ctaText: null, videoStyle: null, videoFormat: '16:9', videoLength: null, videoMood: null, videoSpec: null,
}
const brief: AiVideoBrief = {
  shots: [
    { prompt: 'Slow push-in on the cover', sourceImage: 'cover', durationSec: 5, caption: 'Hook' },
    { prompt: 'Drift across the first page', sourceImage: 'page-1', durationSec: 7, caption: '' },
  ],
  endCard: { headline: 'Read it', cta: 'Buy now' },
}
const kling = { id: 'kwaivgi/kling-v3.0-std', durations: [3, 5, 10], aspectRatios: ['16:9', '9:16', '1:1'], resolutions: ['720p'], pricePerSecond: 0.084 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(null)
  vi.mocked(getVideoModelInfo).mockResolvedValue(kling)
  vi.mocked(submitVideoJob).mockResolvedValueOnce('or_1').mockResolvedValueOnce('or_2')
})

describe('startAiVideoJob', () => {
  it('submits one job per shot from the right image at a supported duration', async () => {
    const job = await startAiVideoJob(book, brief, 'sk')
    expect(submitVideoJob).toHaveBeenNthCalledWith(1, expect.objectContaining({ imageUrl: 'data:/cover.png', durationSec: 5, aspectRatio: '16:9', resolution: '720p' }))
    expect(submitVideoJob).toHaveBeenNthCalledWith(2, expect.objectContaining({ imageUrl: 'data:/p1.png', durationSec: 5 }))
    expect(job.costUsd).toBe(0.84)
    expect(prisma.book.update).toHaveBeenCalledWith({ where: { id: 'book_1' }, data: { aiVideoBrief: brief } })
  })

  it('refuses a format the model cannot make', async () => {
    vi.mocked(getVideoModelInfo).mockResolvedValue({ ...kling, aspectRatios: ['16:9', '9:16'] })
    await expect(startAiVideoJob({ ...book, videoFormat: '1:1' }, brief, 'sk')).rejects.toThrow(/can't make 1:1/)
    expect(submitVideoJob).not.toHaveBeenCalled()
  })

  it('refuses while another AI video is running', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue({ id: 'old' } as any)
    await expect(startAiVideoJob(book, brief, 'sk')).rejects.toBeInstanceOf(AiVideoUserError)
  })
})

describe('advanceAiVideoJob', () => {
  const running = (shots: any[]): any => ({ id: 'job_1', bookId: 'book_1', status: 'running', format: '16:9', brief, shots, model: 'm' })

  it('records progress while shots are still rendering', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'in_progress' })
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }]), book, 'sk', 'pub_1')
    expect((job.shots as any)[0].status).toBe('in_progress')
    expect(stitchAiVideo).not.toHaveBeenCalled()
  })

  it('downloads finished clips and stitches once all are done', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'completed', costUsd: 0.42 })
    vi.mocked(downloadVideoJob).mockResolvedValue(Buffer.from('mp4'))
    const job = await advanceAiVideoJob(
      running([
        { jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null },
        { jobId: 'or_2', durationSec: 5, status: 'pending', clipUrl: null },
      ]),
      book, 'sk', 'pub_1'
    )
    expect(prisma.aiVideoJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job_1', status: 'running' }, data: expect.objectContaining({ costUsd: 0.84 }) })
    )
    expect(stitchAiVideo).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1920, height: 1080, endCardSec: 3, musicPath: '/app/public/music/epic.mp3' })
    )
    expect(job.status).toBe('completed')
    expect(job.videoUrl).toMatch(/ai-video\/job_1\/ai-video\.mp4$/)
  })

  it('fails the job with the model’s message when a shot fails', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'failed', error: 'content policy' })
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }]), book, 'sk', 'pub_1')
    expect(job.status).toBe('failed')
    expect(job.error).toBe('content policy')
  })
})

describe('summarizeJob', () => {
  it('exposes only what the browser needs', () => {
    expect(
      summarizeJob({ id: 'j', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 1, shots: [{ jobId: 'secret', durationSec: 5, status: 'pending', clipUrl: null }] } as any)
    ).toEqual({ id: 'j', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 1, shots: [{ status: 'pending', durationSec: 5 }] })
  })
})
