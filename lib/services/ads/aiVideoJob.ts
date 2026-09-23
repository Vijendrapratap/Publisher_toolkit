import path from 'node:path'
import os from 'node:os'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { AiVideoJob, Book } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getVideoModelName } from '@/lib/providers/ai'
import { readStoredFile, storeFile } from '@/lib/providers/storage'
import {
  downloadVideoJob,
  getVideoJob,
  getVideoModelInfo,
  pickDuration,
  pickResolution,
  submitVideoJob,
} from '@/lib/providers/aiVideo'
import type { AiVideoBrief } from './aiVideoBriefSchema'
import { bookVideoSource, readVideoSpec, resolveMusic, videoDimensions, type AdVideoSpec } from './videoSpec'
import { inlineImage, musicFile } from './videoAssets'
import { renderAdVideo, renderStillPng } from './renderVideo'
import { probeDuration, stitchAiVideo } from './aiVideoStitch'

export type ShotState = {
  jobId: string
  durationSec: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  clipUrl: string | null
  error?: string
  /** What OpenRouter actually billed; can exceed duration × price (minimum billed length). */
  costUsd?: number
}

export interface AiVideoJobSummary {
  id: string
  status: string
  videoUrl: string | null
  posterUrl: string | null
  error: string | null
  costUsd: number | null
  shots: { status: ShotState['status']; durationSec: number }[]
}

/** A problem the publisher can fix; routes return it as a 400 with this message. */
export class AiVideoUserError extends Error {}

const json = (value: unknown) => value as Prisma.InputJsonValue

/** A stitch that dies (crash, restart, OOM) leaves the row here forever otherwise. */
const STITCHING_STALE_MS = 10 * 60 * 1000
/** A shot that never reports back (or a poller nobody keeps calling) leaves the row here forever otherwise. */
const RUNNING_STALE_MS = 60 * 60 * 1000
const TIMEOUT_MESSAGE = 'The AI video took too long. Generate again.'
const ALREADY_RUNNING_MESSAGE = 'An AI video is already being made for this book. Wait for it to finish.'

function sourceImageUrl(book: Book, key: string): string | null {
  if (key === 'cover') return book.frontCoverUrl
  return book.interiorImageUrls[Number(key.replace('page-', '')) - 1] ?? null
}

/** Prisma's P2002 (unique constraint) — duck-typed so tests don't need a real PrismaClientKnownRequestError. */
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && /\b404\b/.test(err.message)
}

export async function startAiVideoJob(book: Book, brief: AiVideoBrief, apiKey: string): Promise<AiVideoJob> {
  const now = Date.now()
  const runningCutoff = new Date(now - RUNNING_STALE_MS)
  const stitchingCutoff = new Date(now - STITCHING_STALE_MS)
  const activeWhere = {
    bookId: book.id,
    OR: [
      { status: 'running', updatedAt: { gte: runningCutoff } },
      { status: 'stitching', updatedAt: { gte: stitchingCutoff } },
    ],
  }

  const active = await prisma.aiVideoJob.findFirst({ where: activeWhere })
  if (active) throw new AiVideoUserError(ALREADY_RUNNING_MESSAGE)

  // A stale row never finished on its own; fail it so it doesn't block the
  // one-active-job-per-book unique index from letting this retry insert.
  await prisma.aiVideoJob.updateMany({
    where: {
      bookId: book.id,
      OR: [
        { status: 'running', updatedAt: { lt: runningCutoff } },
        { status: 'stitching', updatedAt: { lt: stitchingCutoff } },
      ],
    },
    data: { status: 'failed', error: TIMEOUT_MESSAGE },
  })

  const model = getVideoModelName()
  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  const info = await getVideoModelInfo(model, apiKey)
  if (info && info.aspectRatios.length > 0 && !info.aspectRatios.includes(spec.format)) {
    throw new AiVideoUserError(
      `${model} can't make ${spec.format} videos. Switch the Instant Video format to ${info.aspectRatios.join(' or ')}, save, and try again.`
    )
  }

  // Resolve every shot's image BEFORE spending anything: a missing page must
  // not leave earlier shots already submitted (and billed) to OpenRouter.
  const prepared = await Promise.all(
    brief.shots.map(async (shot) => {
      const imageUrl = await inlineImage(sourceImageUrl(book, shot.sourceImage))
      if (!imageUrl) {
        throw new AiVideoUserError(`The image for “${shot.sourceImage}” could not be read. Choose another image for that shot.`)
      }
      return { prompt: shot.prompt, imageUrl, durationSec: pickDuration(shot.durationSec, info?.durations ?? []) }
    })
  )

  const seconds = prepared.reduce((total, s) => total + s.durationSec, 0)
  const estimatedCost = info?.pricePerSecond ? Math.round(seconds * info.pricePerSecond * 100) / 100 : null

  await prisma.book.update({ where: { id: book.id }, data: { aiVideoBrief: json(brief) } })

  let job: AiVideoJob
  try {
    job = await prisma.aiVideoJob.create({
      data: { bookId: book.id, model, format: spec.format, brief: json(brief), shots: json([]), costUsd: estimatedCost },
    })
  } catch (err) {
    // The active check above raced with another request that inserted first.
    if (isUniqueConstraintError(err)) throw new AiVideoUserError(ALREADY_RUNNING_MESSAGE)
    throw err
  }

  // Persist each submitted job's id the instant it comes back, so a mid-way
  // crash still leaves a record of every shot OpenRouter has already billed.
  const shots: ShotState[] = []
  const resolution = pickResolution(info?.resolutions ?? [])
  try {
    for (const shot of prepared) {
      const jobId = await submitVideoJob({
        apiKey,
        model,
        prompt: shot.prompt,
        imageUrl: shot.imageUrl,
        durationSec: shot.durationSec,
        aspectRatio: spec.format,
        resolution,
      })
      shots.push({ jobId, durationSec: shot.durationSec, status: 'pending', clipUrl: null })
      // A snapshot copy: `shots` keeps mutating on later iterations, and this
      // call's payload (and any recorded mock call) must not alias it.
      job = await prisma.aiVideoJob.update({ where: { id: job.id }, data: { shots: json([...shots]), costUsd: estimatedCost } })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The video model rejected the request.'
    job = await prisma.aiVideoJob.update({
      where: { id: job.id },
      data: { shots: json([...shots]), status: 'failed', error: message, costUsd: estimatedCost },
    })
    throw err
  }

  return job
}

async function pollShot(shot: ShotState, i: number, apiKey: string, dir: string): Promise<void> {
  if (shot.status === 'completed' || shot.status === 'failed') return
  try {
    const remote = await getVideoJob(apiKey, shot.jobId)
    if (remote.costUsd !== undefined) shot.costUsd = remote.costUsd
    if (remote.status === 'completed') {
      const clip = await downloadVideoJob(apiKey, shot.jobId)
      shot.clipUrl = (await storeFile(`${dir}/shot-${i + 1}.mp4`, clip, 'video/mp4')).url
      shot.status = 'completed'
    } else if (remote.status === 'failed' || remote.status === 'cancelled' || remote.status === 'expired') {
      shot.status = 'failed'
      shot.error = remote.error ?? `The video model reported “${remote.status}”.`
    } else {
      shot.status = remote.status === 'in_progress' ? 'in_progress' : 'pending'
    }
  } catch (err) {
    // A shot that OpenRouter has lost track of can never complete; anything
    // else (a network blip, a timeout) is retried on the next poll.
    if (isNotFoundError(err)) {
      shot.status = 'failed'
      shot.error = 'The video model no longer has this job.'
    }
  }
}

export async function advanceAiVideoJob(job: AiVideoJob, book: Book, apiKey: string, publisherId: string): Promise<AiVideoJob> {
  const now = Date.now()

  if (job.status === 'stitching') {
    if (now - job.updatedAt.getTime() < STITCHING_STALE_MS) return job
    // The stitch died mid-way. All clips are already stored, so reclaiming
    // and re-stitching costs nothing more.
    const reclaim = await prisma.aiVideoJob.updateMany({
      where: { id: job.id, status: 'stitching', updatedAt: { lt: new Date(now - STITCHING_STALE_MS) } },
      data: { status: 'running' },
    })
    if (reclaim.count === 0) return (await prisma.aiVideoJob.findUnique({ where: { id: job.id } })) ?? job
    job = { ...job, status: 'running' }
  }

  if (job.status !== 'running') return job

  if (now - job.updatedAt.getTime() > RUNNING_STALE_MS) {
    return prisma.aiVideoJob.update({ where: { id: job.id }, data: { status: 'failed', error: TIMEOUT_MESSAGE } })
  }

  const shots = job.shots as unknown as ShotState[]
  const dir = `ads/${publisherId}/ai-video/${job.id}`

  await Promise.all(shots.map((shot, i) => pollShot(shot, i, apiKey, dir)))

  const failed = shots.find((s) => s.status === 'failed')
  if (failed) {
    return prisma.aiVideoJob.update({ where: { id: job.id }, data: { shots: json(shots), status: 'failed', error: failed.error } })
  }
  if (!shots.every((s) => s.status === 'completed')) {
    // Never overwrite a row another poll has already claimed (e.g. moved to stitching).
    await prisma.aiVideoJob.updateMany({ where: { id: job.id, status: 'running' }, data: { shots: json(shots) } })
    return (await prisma.aiVideoJob.findUnique({ where: { id: job.id } })) ?? job
  }
  // Every shot is billed now: replace the estimate with the real total.
  const billed = shots.every((s) => s.costUsd !== undefined)
    ? Math.round(shots.reduce((t, s) => t + (s.costUsd ?? 0), 0) * 100) / 100
    : job.costUsd

  // Claim the stitch so two polls arriving together do not both render it.
  const claim = await prisma.aiVideoJob.updateMany({
    where: { id: job.id, status: 'running' },
    data: { shots: json(shots), status: 'stitching', costUsd: billed },
  })
  if (claim.count === 0) return (await prisma.aiVideoJob.findUnique({ where: { id: job.id } })) ?? job

  try {
    const { videoUrl, posterUrl } = await stitchJob(job, shots, book, dir)
    return prisma.aiVideoJob.update({ where: { id: job.id }, data: { status: 'completed', videoUrl, posterUrl } })
  } catch (err) {
    console.error('ai video stitch failed', err)
    return prisma.aiVideoJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: err instanceof Error ? err.message : 'Putting the video together failed.' },
    })
  }
}

async function stitchJob(job: AiVideoJob, shots: ShotState[], book: Book, dir: string) {
  const brief = job.brief as unknown as AiVideoBrief
  const spec: AdVideoSpec = { ...readVideoSpec(book.videoSpec, bookVideoSource(book)), format: job.format as AdVideoSpec['format'] }
  const { width, height } = videoDimensions(spec.format)
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ai-video-'))
  try {
    // Sequential: each still render starts a browser.
    const clips = []
    for (const [i, shot] of shots.entries()) {
      const clipPath = path.join(tmp, `shot-${i}.mp4`)
      await writeFile(clipPath, (await readStoredFile(shot.clipUrl!)).data)
      const caption = brief.shots[i]?.caption?.trim()
      let captionPath: string | null = null
      if (caption) {
        captionPath = path.join(tmp, `caption-${i}.png`)
        await writeFile(captionPath, await renderStillPng({ spec, caption }, 'AiCaption'))
      }
      clips.push({ path: clipPath, durationSec: Math.min(shot.durationSec, await probeDuration(clipPath)), captionPath })
    }

    const endCard = await renderAdVideo(
      { spec, coverUrl: await inlineImage(book.frontCoverUrl), headline: brief.endCard.headline, cta: brief.endCard.cta },
      'AiEndCard'
    )
    const endCardPath = path.join(tmp, 'end.mp4')
    await writeFile(endCardPath, endCard.videoBuffer)

    const outputPath = path.join(tmp, 'final.mp4')
    await stitchAiVideo({
      clips,
      endCardPath,
      endCardSec: endCard.durationSec,
      width,
      height,
      outputPath,
      musicPath: await musicFile(resolveMusic(spec), tmp),
    })

    const [video, poster] = await Promise.all([
      storeFile(`${dir}/ai-video.mp4`, await readFile(outputPath), 'video/mp4'),
      storeFile(`${dir}/ai-poster.png`, endCard.posterBuffer, 'image/png'),
    ])
    return { videoUrl: video.url, posterUrl: poster.url }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

export function summarizeJob(job: AiVideoJob): AiVideoJobSummary {
  const shots = job.shots as unknown as ShotState[]
  return {
    id: job.id,
    status: job.status,
    videoUrl: job.videoUrl,
    posterUrl: job.posterUrl,
    error: job.error,
    costUsd: job.costUsd,
    shots: shots.map((s) => ({ status: s.status, durationSec: s.durationSec })),
  }
}
