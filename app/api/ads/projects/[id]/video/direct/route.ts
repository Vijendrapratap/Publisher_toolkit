import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { isAiConfigured } from '@/lib/providers/ai'
import { rateLimited } from '@/lib/rateLimit'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { bookVideoSource, readVideoSpec, type AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { directorImages } from '@/lib/services/ads/videoAssets'
import { directAd, drawSetting } from '@/lib/services/ads/adDirector'
import { getDurationForLength } from '@/lib/services/trailer/options'
import { prisma } from '@/lib/db'

export const maxDuration = 180

const bodySchema = z.object({
  instruction: z.string().trim().max(400).optional(),
  revise: z.boolean().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  if (rateLimited(`direct:${publisherId}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  if (!isAiConfigured()) return NextResponse.json({ error: 'AI directing is not available right now.' }, { status: 400 })

  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  const current = parsed.data.revise ? spec.storyboard : undefined
  const result = await directAd(
    {
      title: book.title ?? 'Untitled book',
      author: book.author,
      blurb: book.blurb,
      bullets: book.bullets,
      categories: book.categories,
      pageCount: book.interiorImageUrls.length,
      cta: spec.script.cta,
      hook: book.customHook,
    },
    await directorImages(book),
    { format: spec.format, lengthSec: getDurationForLength(spec.length), mood: spec.mood, style: spec.style, current, instruction: parsed.data.instruction }
  )

  // Draw a new setting only when the AI actually wrote a different one.
  const sameSetting = current && current.theme.settingPrompt === result.data.theme.settingPrompt
  const settingImageUrl =
    result.source === 'ai' && !sameSetting
      ? await drawSetting(result.data.theme.settingPrompt, spec.format, publisherId)
      : (current?.theme.settingImageUrl ?? null)

  const next: AdVideoSpec = { ...spec, storyboard: { ...result.data, theme: { ...result.data.theme, settingImageUrl } } }
  await prisma.book.update({ where: { id: book.id }, data: { videoSpec: next } })
  return NextResponse.json({ spec: next, source: result.source })
}
