import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getVideoModelName, resolveApiKey } from '@/lib/providers/ai'
import { getVideoModelInfo, type VideoModelInfo } from '@/lib/providers/aiVideo'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { aiVideoBriefSchema } from '@/lib/services/ads/aiVideoBriefSchema'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob, summarizeJob } from '@/lib/services/ads/aiVideoJob'
import { prisma } from '@/lib/db'
import { refundReservation, reserveCredits, settleReservation } from '@/lib/credits/ledger'
import { aiVideoUnits } from '@/lib/credits/prices'
import { creditErrorResponse } from '@/lib/credits/charge'

// Stitching (captions, end card, ffmpeg) happens inside a poll.
export const maxDuration = 300

const bodySchema = z.object({ brief: aiVideoBriefSchema })
const NO_KEY = 'AI video is not available right now.'

// The panel polls this route every 5s while a job is active; the model's
// price/durations/aspect ratios barely ever change, so re-fetching them from
// OpenRouter on every poll is pure waste. Keyed by model, not by publisher
// or API key — capability info doesn't vary per caller.
const MODEL_INFO_TTL_MS = 5 * 60 * 1000
// Only ever holds a successful lookup — a transient failure (network blip,
// OpenRouter hiccup) must not lock the panel out of a working lookup for
// the rest of the TTL.
const modelInfoCache = new Map<string, { value: VideoModelInfo; expiresAt: number }>()

async function cachedVideoModelInfo(model: string, apiKey: string): Promise<VideoModelInfo | null> {
  const cached = modelInfoCache.get(model)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const value = await getVideoModelInfo(model, apiKey).catch(() => null)
  if (value) modelInfoCache.set(model, { value, expiresAt: Date.now() + MODEL_INFO_TTL_MS })
  return value
}

export function __resetVideoModelInfoCacheForTests(): void {
  modelInfoCache.clear()
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the video prompt' }, { status: 400 })
  }
  const apiKey = resolveApiKey()
  if (!apiKey) return NextResponse.json({ error: NO_KEY }, { status: 400 })

  const jobId = randomUUID()
  const key = `video:${jobId}`
  try {
    await reserveCredits({
      userId: publisherId,
      action: 'ads.video.ai',
      units: aiVideoUnits(parsed.data.brief.shots.map((s) => s.durationSec)),
      refId: book.id,
      key,
    })
  } catch (err) {
    const creditResponse = creditErrorResponse(err)
    if (creditResponse) return creditResponse
    throw err
  }
  try {
    const job = await startAiVideoJob(book, parsed.data.brief, apiKey, jobId)
    return NextResponse.json({ job: summarizeJob(job) }, { status: 202 })
  } catch (err) {
    // A job row may exist and already be failed; the refund key is the same
    // either way. A failure here must not mask the original error below — the
    // sweep closes anything this leaves stuck (unsettled + no/failed job row).
    try {
      await refundReservation(key)
    } catch (refundErr) {
      console.error('ai video credit refund failed', key, refundErr)
    }
    if (err instanceof AiVideoUserError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('ai video start failed', err)
    return NextResponse.json({ error: 'The AI video could not be started. Please try again.' }, { status: 500 })
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const apiKey = resolveApiKey()
  const latest = await prisma.aiVideoJob.findFirst({ where: { bookId: book.id }, orderBy: { createdAt: 'desc' } })
  let job = latest
  if (latest && apiKey) {
    try {
      job = await advanceAiVideoJob(latest, book, apiKey, publisherId)
    } catch (err) {
      // A poll failure must not break the panel's status display — show what's stored and retry next time.
      console.error('ai video advance failed', err)
      job = latest
    }
  }
  // Idempotent: only the first settle/refund of a key applies, so every poll
  // may call these. A throw here must not break the poll response — the next
  // poll retries, since both calls are idempotent.
  if (job?.status === 'completed') {
    try {
      await settleReservation(`video:${job.id}`, { costUsd: job.costUsd ?? undefined })
    } catch (err) {
      console.error('ai video credit settle failed', err)
    }
  }
  if (job?.status === 'failed') {
    try {
      await refundReservation(`video:${job.id}`)
    } catch (err) {
      console.error('ai video credit refund failed', err)
    }
  }

  const info = apiKey ? await cachedVideoModelInfo(getVideoModelName(), apiKey) : null

  return NextResponse.json({
    job: job ? summarizeJob(job) : null,
    aiConfigured: Boolean(apiKey),
    model: info && { id: info.id, pricePerSecond: info.pricePerSecond, durations: info.durations, aspectRatios: info.aspectRatios },
  })
}
