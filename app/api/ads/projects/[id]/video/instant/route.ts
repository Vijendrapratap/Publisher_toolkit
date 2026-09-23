import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { bookVideoSource, readVideoSpec, resolveMusic } from '@/lib/services/ads/videoSpec'
import { adVideoImages, inlineMusic } from '@/lib/services/ads/videoAssets'
import { describeRenderError, renderAdVideo } from '@/lib/services/ads/renderVideo'
import { storeFile } from '@/lib/providers/storage'
import { prisma } from '@/lib/db'

export const maxDuration = 300

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (!set) return NextResponse.json({ error: 'Generate the campaign before exporting a video.' }, { status: 400 })

  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  try {
    const video = await renderAdVideo({
      spec,
      title: book.title ?? 'Untitled book',
      author: book.author ?? '',
      musicSrc: await inlineMusic(resolveMusic(spec), publisherId),
      ...(await adVideoImages(book)),
    })

    // A new name per export, so the browser never plays a cached older cut.
    const stamp = Date.now().toString(36)
    const dir = `ads/${publisherId}/creatives/${set.id}`
    const [mp4, poster] = await Promise.all([
      storeFile(`${dir}/video-${stamp}.mp4`, video.videoBuffer, 'video/mp4'),
      storeFile(`${dir}/poster-${stamp}.png`, video.posterBuffer, 'image/png'),
    ])
    const videoDuration = Math.round(video.durationSec)
    await prisma.creativeSet.update({
      where: { id: set.id },
      data: { videoUrl: mp4.url, videoPosterUrl: poster.url, videoDuration },
    })
    return NextResponse.json({ videoUrl: mp4.url, videoPosterUrl: poster.url, videoDuration })
  } catch (err) {
    console.error('instant video export failed', err)
    return NextResponse.json({ error: describeRenderError(err) }, { status: 500 })
  }
}
