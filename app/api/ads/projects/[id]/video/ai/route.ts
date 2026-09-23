import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { getVideoModelName, resolveApiKey } from '@/lib/providers/ai'
import { getVideoModelInfo } from '@/lib/providers/aiVideo'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { aiVideoBriefSchema } from '@/lib/services/ads/aiVideoBriefSchema'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob, summarizeJob } from '@/lib/services/ads/aiVideoJob'
import { prisma } from '@/lib/db'

// Stitching (captions, end card, ffmpeg) happens inside a poll.
export const maxDuration = 300

const bodySchema = z.object({ brief: aiVideoBriefSchema })
const NO_KEY = 'Add an OpenRouter API key in Settings to use AI video.'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the video prompt' }, { status: 400 })
  }
  const apiKey = resolveApiKey(await getPublisherAiCredentials(publisherId))
  if (!apiKey) return NextResponse.json({ error: NO_KEY }, { status: 400 })

  try {
    const job = await startAiVideoJob(book, parsed.data.brief, apiKey)
    return NextResponse.json({ job: summarizeJob(job) }, { status: 202 })
  } catch (err) {
    if (err instanceof AiVideoUserError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('ai video start failed', err)
    const message = err instanceof Error ? err.message : 'The AI video could not be started.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const apiKey = resolveApiKey(await getPublisherAiCredentials(publisherId))
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
  const info = apiKey ? await getVideoModelInfo(getVideoModelName(), apiKey).catch(() => null) : null

  return NextResponse.json({
    job: job ? summarizeJob(job) : null,
    aiConfigured: Boolean(apiKey),
    model: info && { id: info.id, pricePerSecond: info.pricePerSecond, durations: info.durations, aspectRatios: info.aspectRatios },
  })
}
