import path from 'node:path'
import os from 'node:os'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { AiVideoJob, Book, Prisma } from '@prisma/client'
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

function sourceImageUrl(book: Book, key: string): string | null {
  if (key === 'cover') return book.frontCoverUrl
  return book.interiorImageUrls[Number(key.replace('page-', '')) - 1] ?? null
}

export async function startAiVideoJob(book: Book, brief: AiVideoBrief, apiKey: string): Promise<AiVideoJob> {
  const active = await prisma.aiVideoJob.findFirst({ where: { bookId: book.id, status: { in: ['running', 'stitching'] } } })
  if (active) throw new AiVideoUserError('An AI video is already being made for this book. Wait for it to finish.')

  const model = getVideoModelName()
  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  const info = await getVideoModelInfo(model, apiKey)
  if (info && info.aspectRatios.length > 0 && !info.aspectRatios.includes(spec.format)) {
    throw new AiVideoUserError(
      `${model} can't make ${spec.format} videos. Switch the Instant Video format to ${info.aspectRatios.join(' or ')}, save, and try again.`
    )
  }

  // ponytail: shots submitted one after another; a failure midway leaves earlier
  // jobs running (and billed) with no row. Submission takes seconds, so accepted.
  const shots: ShotState[] = []
  for (const shot of brief.shots) {
    const imageUrl = await inlineImage(sourceImageUrl(book, shot.sourceImage))
    if (!imageUrl) throw new AiVideoUserError(`The image for “${shot.sourceImage}” could not be read. Choose another image for that shot.`)
    const durationSec = pickDuration(shot.durationSec, info?.durations ?? [])
    const jobId = await submitVideoJob({
      apiKey,
      model,
      prompt: shot.prompt,
      imageUrl,
      durationSec,
      aspectRatio: spec.format,
      resolution: pickResolution(info?.resolutions ?? []),
    })
    shots.push({ jobId, durationSec, status: 'pending', clipUrl: null })
  }

  const seconds = shots.reduce((total, s) => total + s.durationSec, 0)
  await prisma.book.update({ where: { id: book.id }, data: { aiVideoBrief: json(brief) } })
  return prisma.aiVideoJob.create({
    data: {
      bookId: book.id,
      model,
      format: spec.format,
      brief: json(brief),
      shots: json(shots),
      costUsd: info?.pricePerSecond ? Math.round(seconds * info.pricePerSecond * 100) / 100 : null,
    },
  })
}

export async function advanceAiVideoJob(job: AiVideoJob, book: Book, apiKey: string, publisherId: string): Promise<AiVideoJob> {
  if (job.status !== 'running') return job
  const shots = job.shots as unknown as ShotState[]
  const dir = `ads/${publisherId}/ai-video/${job.id}`

  await Promise.all(
    shots.map(async (shot, i) => {
      if (shot.status === 'completed' || shot.status === 'failed') return
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
    })
  )

  const failed = shots.find((s) => s.status === 'failed')
  if (failed) {
    return prisma.aiVideoJob.update({ where: { id: job.id }, data: { shots: json(shots), status: 'failed', error: failed.error } })
  }
  if (!shots.every((s) => s.status === 'completed')) {
    return prisma.aiVideoJob.update({ where: { id: job.id }, data: { shots: json(shots) } })
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
