import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { pushCreativeSet } from '@/lib/providers/adsPush'

const bodySchema = z.object({ platform: z.enum(['META', 'GOOGLE']) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Push is available for Meta and Google only.' }, { status: 400 })
  }

  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (!set) return NextResponse.json({ error: 'Generate creatives before pushing.' }, { status: 400 })

  const receipt = await pushCreativeSet({
    platform: parsed.data.platform,
    bookTitle: book.title ?? '',
    imageCount: set.images.filter((i) => i.platform === parsed.data.platform).length,
  })
  return NextResponse.json(receipt)
}
