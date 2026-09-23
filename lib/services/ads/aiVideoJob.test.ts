import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiVideoBrief } from './aiVideoBriefSchema'
import { OpenRouterHttpError } from '@/lib/providers/aiVideo'

// A minimal in-memory stand-in for prisma.aiVideoJob: real enough (id lookup,
// status-guarded updateMany, merge semantics) that the guarded
// write-then-reread patterns in the service can be tested honestly, instead
// of hand-crafting the shape of every mocked call's return value.
// vi.hoisted: vi.mock's factory below runs at hoist time, before ordinary
// top-level declarations — this must be defined through vi.hoisted so the
// factory can see it.
const { aiVideoJobStore, resetDb, getRows } = vi.hoisted(() => {
  let rows: Map<string, any>
  let idSeq: number

  function matchesWhere(row: any, where: Record<string, any>): boolean {
    for (const [key, cond] of Object.entries(where)) {
      if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('in' in cond) {
          if (!cond.in.includes(row[key])) return false
          continue
        }
        if ('lt' in cond) {
          if (!(row[key] instanceof Date) || !(row[key].getTime() < cond.lt.getTime())) return false
          continue
        }
        continue
      }
      if (row[key] !== cond) return false
    }
    return true
  }

  function reset(seed: any[] = []) {
    rows = new Map(seed.map((r) => [r.id, { ...r }]))
    idSeq = 0
  }
  reset()

  return {
    getRows: () => rows,
    resetDb: reset,
    aiVideoJobStore: {
      create: vi.fn(async ({ data }: any) => {
        idSeq += 1
        const id = `job_${idSeq}`
        const row = { id, status: 'running', videoUrl: null, posterUrl: null, error: null, createdAt: new Date(), updatedAt: new Date(), ...data }
        rows.set(id, row)
        return { ...row }
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = rows.get(where.id)
        if (!row) throw new Error(`no row ${where.id}`)
        Object.assign(row, data, { updatedAt: new Date() })
        return { ...row }
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0
        for (const row of rows.values()) {
          if (!matchesWhere(row, where)) continue
          Object.assign(row, data, { updatedAt: new Date() })
          count++
        }
        return { count }
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const row = rows.get(where.id)
        return row ? { ...row } : null
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        for (const row of rows.values()) {
          if (matchesWhere(row, where)) return { ...row }
        }
        return null
      }),
    },
  }
})

vi.mock('@/lib/db', () => ({
  prisma: { aiVideoJob: aiVideoJobStore, book: { update: vi.fn(async () => ({})) } },
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
  inlineImage: vi.fn(async (u: string | null | undefined) => (u ? `data:${u}` : null)),
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
import { inlineImage } from './videoAssets'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob, summarizeJob } from './aiVideoJob'

const book: any = {
  id: 'book_1', publisherId: 'pub_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: '/cover.png', interiorImageUrls: ['/p1.png'],
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

// A 1-shot brief: fixtures below that pass a single shot to `running(...)`
// must match it (`brief`, module-level, has 2), or the submit-window check
// (shots.length < brief.shots.length) intercepts them before polling runs.
const singleShotBrief: AiVideoBrief = {
  shots: [{ prompt: 'Slow push-in on the cover', sourceImage: 'cover', durationSec: 5, caption: 'Hook' }],
  endCard: { headline: 'Read it', cta: 'Buy now' },
}

const STITCHING_STALE_MS = 10 * 60 * 1000
const RUNNING_TIMEOUT_MS = 60 * 60 * 1000
const SUBMIT_TIMEOUT_MS = 10 * 60 * 1000
const staleDate = (ms: number) => new Date(Date.now() - ms)

beforeEach(() => {
  vi.clearAllMocks()
  resetDb([])
  vi.mocked(getVideoModelInfo).mockResolvedValue(kling)
  vi.mocked(getVideoJob).mockResolvedValue({ status: 'in_progress' })
  // Reassert the default so a test that overrides it (below) can't leak into the next one.
  vi.mocked(inlineImage).mockImplementation(async (u: string | null | undefined) => (u ? `data:${u}` : null))
})

describe('startAiVideoJob', () => {
  it('submits one job per shot from the right image at a supported duration', async () => {
    vi.mocked(submitVideoJob).mockResolvedValueOnce('or_1').mockResolvedValueOnce('or_2')
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

  it("resolves every shot's image before spending anything, so a missing image submits nothing", async () => {
    vi.mocked(inlineImage).mockImplementation(async (u: string | null | undefined) => (u === book.frontCoverUrl ? null : `data:${u}`))
    await expect(startAiVideoJob(book, brief, 'sk')).rejects.toBeInstanceOf(AiVideoUserError)
    expect(submitVideoJob).not.toHaveBeenCalled()
    expect(prisma.aiVideoJob.create).not.toHaveBeenCalled()
  })

  it('creates the job row before the first submit and persists each jobId as it comes back', async () => {
    vi.mocked(submitVideoJob).mockResolvedValueOnce('or_1').mockResolvedValueOnce('or_2')
    await startAiVideoJob(book, brief, 'sk')
    const createOrder = vi.mocked(prisma.aiVideoJob.create).mock.invocationCallOrder[0]
    const firstSubmitOrder = vi.mocked(submitVideoJob).mock.invocationCallOrder[0]
    expect(createOrder).toBeLessThan(firstSubmitOrder)

    const updateCalls = vi.mocked(prisma.aiVideoJob.update).mock.calls
    expect(updateCalls[0][0]).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ shots: [{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }] }) })
    )
    expect(updateCalls[1][0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          shots: [
            { jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null },
            { jobId: 'or_2', durationSec: 5, status: 'pending', clipUrl: null },
          ],
        }),
      })
    )
  })

  it('maps a duplicate active job at the database level to the same friendly error', async () => {
    vi.mocked(prisma.aiVideoJob.create).mockRejectedValueOnce(Object.assign(new Error('Unique constraint failed on the fields: (`bookId`)'), { code: 'P2002' }))
    await expect(startAiVideoJob(book, brief, 'sk')).rejects.toBeInstanceOf(AiVideoUserError)
    expect(submitVideoJob).not.toHaveBeenCalled()
  })

  it('stops submitting once the row is no longer running', async () => {
    vi.mocked(submitVideoJob).mockImplementationOnce(async () => {
      const row = getRows().get('job_1')
      if (row) row.status = 'failed'
      return 'or_1'
    })
    await expect(startAiVideoJob(book, brief, 'sk')).rejects.toBeInstanceOf(AiVideoUserError)
    expect(submitVideoJob).toHaveBeenCalledTimes(1)
  })

  it('refuses while another AI video job is still active after being given a chance to advance', async () => {
    resetDb([
      {
        id: 'active_1', bookId: 'book_1', status: 'running', model: 'm', format: '16:9',
        brief: { shots: [{ prompt: 'x', sourceImage: 'cover', durationSec: 5, caption: '' }], endCard: { headline: 'h', cta: 'c' } },
        shots: [{ jobId: 'or_active', durationSec: 5, status: 'pending', clipUrl: null }],
        videoUrl: null, posterUrl: null, error: null, costUsd: 0.1,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ])
    await expect(startAiVideoJob(book, brief, 'sk')).rejects.toBeInstanceOf(AiVideoUserError)
    expect(submitVideoJob).not.toHaveBeenCalled()
  })

  it('lets a new job start once advancing the stuck active row resolves it', async () => {
    resetDb([
      {
        id: 'active_1', bookId: 'book_1', status: 'running', model: 'm', format: '16:9',
        brief: { shots: [{ prompt: 'x', sourceImage: 'cover', durationSec: 5, caption: '' }], endCard: { headline: 'h', cta: 'c' } },
        shots: [{ jobId: 'or_active', durationSec: 5, status: 'completed', clipUrl: '/api/files/old.mp4', costUsd: 0.1 }],
        videoUrl: null, posterUrl: null, error: null, costUsd: 0.1,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ])
    vi.mocked(submitVideoJob).mockResolvedValueOnce('or_1').mockResolvedValueOnce('or_2')
    const job = await startAiVideoJob(book, brief, 'sk')
    expect(getVideoJob).not.toHaveBeenCalled() // the old job's one shot was already completed
    expect(stitchAiVideo).toHaveBeenCalledTimes(1) // the old job got stitched, not failed
    expect(submitVideoJob).toHaveBeenCalledTimes(2) // the new job's own shots
    expect(job.costUsd).toBe(0.84)
  })
})

describe('advanceAiVideoJob', () => {
  const running = (shots: any[], overrides: Partial<any> = {}): any => {
    const row = {
      id: 'job_1', bookId: 'book_1', status: 'running', format: '16:9', brief, shots, model: 'm',
      videoUrl: null, posterUrl: null, error: null, costUsd: null,
      createdAt: new Date(), updatedAt: new Date(), ...overrides,
    }
    resetDb([row])
    return row
  }

  it('records progress while shots are still rendering', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'in_progress' })
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }], { brief: singleShotBrief }), book, 'sk', 'pub_1')
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
    expect(stitchAiVideo).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1920, height: 1080, endCardSec: 3, musicPath: '/app/public/music/epic.mp3' })
    )
    expect(job.status).toBe('completed')
    expect(job.costUsd).toBe(0.84)
    expect(job.videoUrl).toMatch(/ai-video\/job_1\/ai-video\.mp4$/)
  })

  it('fails the job with the model’s message when a shot fails', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'failed', error: 'content policy' })
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }], { brief: singleShotBrief }), book, 'sk', 'pub_1')
    expect(job.status).toBe('failed')
    expect(job.error).toBe('content policy')
  })

  it("does not let one shot's poll error fail the whole advance", async () => {
    vi.mocked(getVideoJob).mockImplementation(async (_apiKey: string, id: string) => {
      if (id === 'or_1') throw new Error('network blip')
      return { status: 'in_progress' }
    })
    const job = await advanceAiVideoJob(
      running([
        { jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null },
        { jobId: 'or_2', durationSec: 5, status: 'pending', clipUrl: null },
      ]),
      book, 'sk', 'pub_1'
    )
    expect((job.shots as any)[0].status).toBe('pending')
    expect((job.shots as any)[1].status).toBe('in_progress')
  })

  it('marks a shot failed when OpenRouter no longer has its clip (a typed 404)', async () => {
    vi.mocked(getVideoJob).mockRejectedValue(new OpenRouterHttpError('video job not found', 404))
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }], { brief: singleShotBrief }), book, 'sk', 'pub_1')
    expect(job.status).toBe('failed')
    expect((job.shots as any)[0].status).toBe('failed')
  })

  it('leaves a shot in_progress (not failed) when the completed clip fails to download', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'completed', costUsd: 0.42 })
    vi.mocked(downloadVideoJob).mockRejectedValue(new Error('temporary network error'))
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }], { brief: singleShotBrief }), book, 'sk', 'pub_1')
    expect(job.status).toBe('running')
    expect((job.shots as any)[0].status).toBe('in_progress')
    expect(stitchAiVideo).not.toHaveBeenCalled()
  })

  it('reclaims a stale stitching job and re-stitches the already-downloaded clips', async () => {
    const job = await advanceAiVideoJob(
      running(
        [
          { jobId: 'or_1', durationSec: 5, status: 'completed', clipUrl: '/api/files/clip1.mp4', costUsd: 0.42 },
          { jobId: 'or_2', durationSec: 5, status: 'completed', clipUrl: '/api/files/clip2.mp4', costUsd: 0.42 },
        ],
        { status: 'stitching', updatedAt: staleDate(STITCHING_STALE_MS + 1000) }
      ),
      book, 'sk', 'pub_1'
    )
    expect(getVideoJob).not.toHaveBeenCalled()
    expect(stitchAiVideo).toHaveBeenCalled()
    expect(job.status).toBe('completed')
  })

  it('leaves a stitching job alone while it is still within the grace window', async () => {
    const job = await advanceAiVideoJob(
      running([{ jobId: 'or_1', durationSec: 5, status: 'completed', clipUrl: '/x.mp4' }], { status: 'stitching', updatedAt: staleDate(1000) }),
      book, 'sk', 'pub_1'
    )
    expect(job.status).toBe('stitching')
    expect(stitchAiVideo).not.toHaveBeenCalled()
  })

  it('fails a job older than 60 minutes that still has a shot pending after this poll', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'in_progress' })
    const job = await advanceAiVideoJob(
      running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }], { brief: singleShotBrief, createdAt: staleDate(RUNNING_TIMEOUT_MS + 1000) }),
      book, 'sk', 'pub_1'
    )
    expect(job.status).toBe('failed')
    expect(job.error).toMatch(/took too long/)
  })

  it('downloads and stitches a job older than 60 minutes whose shots report completed on this poll', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'completed', costUsd: 0.42 })
    vi.mocked(downloadVideoJob).mockResolvedValue(Buffer.from('mp4'))
    const job = await advanceAiVideoJob(
      running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }], { brief: singleShotBrief, createdAt: staleDate(RUNNING_TIMEOUT_MS + 1000) }),
      book, 'sk', 'pub_1'
    )
    expect(job.status).toBe('completed')
    expect(stitchAiVideo).toHaveBeenCalled()
  })

  it('leaves a job unchanged while shots are still being submitted', async () => {
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }]), book, 'sk', 'pub_1')
    expect(job.status).toBe('running')
    expect((job.shots as any).length).toBe(1)
    expect(getVideoJob).not.toHaveBeenCalled()
    expect(prisma.aiVideoJob.update).not.toHaveBeenCalled()
    expect(prisma.aiVideoJob.updateMany).not.toHaveBeenCalled()
  })

  it('fails a submission stuck for more than 10 minutes', async () => {
    const job = await advanceAiVideoJob(
      running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }], { createdAt: staleDate(SUBMIT_TIMEOUT_MS + 1000) }),
      book, 'sk', 'pub_1'
    )
    expect(job.status).toBe('failed')
    expect(job.error).toMatch(/interrupted/)
  })

  it('does not let a completed-stitch write clobber a row that moved on mid-stitch', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'completed', costUsd: 0.42 })
    vi.mocked(downloadVideoJob).mockResolvedValue(Buffer.from('mp4'))
    vi.mocked(stitchAiVideo).mockImplementationOnce(async () => {
      const row = getRows().get('job_1')
      if (row) {
        row.status = 'failed'
        row.error = 'raced elsewhere'
      }
    })
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }], { brief: singleShotBrief }), book, 'sk', 'pub_1')
    expect(job.status).toBe('failed')
    expect(job.error).toBe('raced elsewhere')
  })
})

describe('summarizeJob', () => {
  it('exposes only what the browser needs', () => {
    expect(
      summarizeJob({ id: 'j', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 1, shots: [{ jobId: 'secret', durationSec: 5, status: 'pending', clipUrl: null }] } as any)
    ).toEqual({ id: 'j', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 1, shots: [{ status: 'pending', durationSec: 5 }] })
  })
})
