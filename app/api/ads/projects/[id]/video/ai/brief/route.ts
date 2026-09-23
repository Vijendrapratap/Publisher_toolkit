import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { isAiConfigured } from '@/lib/providers/ai'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { generateAiVideoBrief } from '@/lib/services/ads/aiVideoBrief'
import { aiVideoBriefSchema } from '@/lib/services/ads/aiVideoBriefSchema'
import { bookVideoSource, readVideoSpec } from '@/lib/services/ads/videoSpec'

export const maxDuration = 60

const bodySchema = z.object({
  current: aiVideoBriefSchema.optional(),
  instruction: z.string().trim().max(400).optional(),
})

/** Pages beyond five are not offered as shot sources; the brief stays readable. */
const MAX_PAGES = 5

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid video prompt' }, { status: 400 })
  }

  const credentials = await getPublisherAiCredentials(publisherId)
  if (!isAiConfigured(credentials)) {
    return NextResponse.json({ error: 'Add an OpenRouter API key in Settings to use AI video.' }, { status: 400 })
  }

  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  const result = await generateAiVideoBrief(
    {
      title: book.title ?? 'Untitled book',
      author: book.author,
      blurb: book.blurb,
      bullets: book.bullets,
      categories: book.categories,
      cta: spec.script.cta,
      pageCount: Math.min(book.interiorImageUrls.length, MAX_PAGES),
    },
    { current: parsed.data.current, instruction: parsed.data.instruction, format: spec.format },
    credentials
  )
  return NextResponse.json({ brief: result.data, source: result.source })
}
