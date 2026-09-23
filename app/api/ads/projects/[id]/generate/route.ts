import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { generateAdCopy, type AdPlatform } from '@/lib/services/ads/copy'
import { renderCreativeImages } from '@/lib/services/ads/render'
import { readStoredFile, storeFile, toDataUri } from '@/lib/providers/storage'
import { getCampaignObjective, type CopyTone } from '@/lib/services/ads/options'
import { describeRenderError, renderAdVideo } from '@/lib/services/ads/renderVideo'
import { adVideoImages, inlineMusic } from '@/lib/services/ads/videoAssets'
import { bookVideoSource, readVideoSpec, resolveMusic } from '@/lib/services/ads/videoSpec'
import { prisma } from '@/lib/db'

export const maxDuration = 300

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!book.frontCoverUrl) {
    return NextResponse.json({ error: 'Add a cover image before generating.' }, { status: 400 })
  }

  const platforms = book.platforms as AdPlatform[]
  const details = { title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '' }

  try {
    const [coverFile, credentials] = await Promise.all([
      readStoredFile(book.frontCoverUrl),
      getPublisherAiCredentials(publisherId),
    ])
    const objective = getCampaignObjective(book.campaignObjective)
    const ctaText = book.ctaText ?? objective.defaultCta

    const [copyResult, renderedImages] = await Promise.all([
      generateAdCopy(details, {
        tone: book.copyTone as CopyTone,
        platforms,
        campaignObjective: book.campaignObjective ?? 'launch',
        targetAudience: book.targetAudience ?? undefined,
        customHook: book.customHook ?? undefined,
        ctaText,
        credentials,
      }),
      renderCreativeImages({
        coverImageUrl: toDataUri(coverFile),
        title: details.title,
        author: details.author,
        templateKey: book.templateKey,
        platforms,
        campaignBadge: objective.badge,
        ctaText,
      }),
    ])

    // One editable row per selected platform, blank when AI copy failed.
    const copyRows = platforms.map(
      (platform) =>
        copyResult.data.find((v) => v.platform === platform) ?? {
          platform,
          headline: '',
          primaryText: '',
          description: '',
        }
    )

    const creativeSetId = crypto.randomUUID()
    const setDir = `ads/${publisherId}/creatives/${creativeSetId}`

    const images = await Promise.all(
      renderedImages.map(async (img) => {
        const { url } = await storeFile(`${setDir}/${img.sizeKey}.png`, img.pngBuffer, 'image/png')
        return { platform: img.platform, sizeKey: img.sizeKey, width: img.width, height: img.height, imageUrl: url }
      })
    )

    let videoUrl: string | null = null
    let videoPosterUrl: string | null = null
    let videoDuration: number | null = null
    let videoError: string | null = null

    if (book.includeVideo !== false) {
      try {
        const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
        const video = await renderAdVideo({
          spec,
          title: details.title || 'Untitled book',
          author: details.author,
          musicSrc: await inlineMusic(resolveMusic(spec), publisherId),
          ...(await adVideoImages(book)),
        })

        const [videoUpload, posterUpload] = await Promise.all([
          storeFile(`${setDir}/video-trailer.mp4`, video.videoBuffer, 'video/mp4'),
          storeFile(`${setDir}/video-poster.png`, video.posterBuffer, 'image/png'),
        ])

        videoUrl = videoUpload.url
        videoPosterUrl = posterUpload.url
        videoDuration = Math.round(video.durationSec)
      } catch (err) {
        // The images are the deliverable; a failed trailer must not discard
        // them — but it must not be silent either.
        console.warn('ads generation: trailer skipped —', err)
        videoError = describeRenderError(err)
      }
    }

    await prisma.book.update({
      where: { id: book.id },
      data: {
        status: 'generated',
        creativeSets: {
          create: {
            id: creativeSetId,
            campaignName: book.campaignName,
            campaignObjective: book.campaignObjective,
            templateKey: book.templateKey,
            videoUrl,
            videoPosterUrl,
            videoDuration,
            adCopies: { createMany: { data: copyRows } },
            images: { createMany: { data: images } },
          },
        },
      },
    })

    const warning =
      [
        copyResult.source === 'fallback'
          ? 'Ad copy is sample text — AI generation was unavailable, so review it before running.'
          : null,
        videoError ? 'The video trailer could not be rendered; the images are ready.' : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined

    return NextResponse.json(
      { creativeSetId, copySource: copyResult.source, videoError, warning },
      { status: 201 }
    )
  } catch (err) {
    console.error('ads generation failed', err)
    return NextResponse.json(
      { error: "We couldn't generate your creatives. Check your cover image and try again." },
      { status: 500 }
    )
  }
}
