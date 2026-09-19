import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { buildCreativeZip, zipFileName } from '@/lib/services/ads/zip'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (!set) return NextResponse.json({ error: 'Nothing generated yet' }, { status: 404 })

  const buffer = await buildCreativeZip({
    title: book.title ?? '',
    images: set.images,
    copies: set.adCopies,
    videoUrl: set.videoUrl,
    videoPosterUrl: set.videoPosterUrl,
  })
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFileName(book.title ?? '')}"`,
    },
  })
}
