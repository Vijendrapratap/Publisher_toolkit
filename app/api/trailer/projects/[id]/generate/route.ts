import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { renderVideoAd, VideoAdRenderError } from '@/lib/services/videoad/render'
import { generateAdScene, generateAdScript } from '@/lib/services/videoad/copy'
import { getPreset, inferPreset } from '@/lib/services/videoad/presets'
import { toTrailerLength } from '@/lib/services/trailer/options'
import { readStoredFile, storeFile } from '@/lib/providers/storage'
import { assetPath } from '@/lib/services/shared/upload'
import { prisma } from '@/lib/db'

export const maxDuration = 300

const DEFAULT_FORMATS = ['1:1', '16:9', '9:16']

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const preset = project.adPreset
    ? getPreset(project.adPreset)
    : inferPreset({ categories: project.categories, title: project.title })

  const credentials = await getPublisherAiCredentials(publisherId)

  const readImage = (url: string | null) =>
    url
      ? readStoredFile(url)
          .then((f) => f.data)
          .catch(() => null)
      : Promise.resolve(null)

  try {
    // The script, the scene and the imagery are independent; waiting on them in
    // series added the slowest of each to every render.
    const [scriptResult, coverBuffer, interiorBuffers, sceneBuffer] = await Promise.all([
      project.adHeadline && project.adBenefits.length > 0
        ? Promise.resolve({
            data: {
              headline: project.adHeadline,
              benefits: project.adBenefits,
              ctaText: project.ctaText || preset.cta,
            },
            source: 'ai' as const,
          })
        : generateAdScript(
            {
              title: project.title ?? 'Untitled Book',
              author: project.author,
              blurb: project.blurb,
              bullets: project.bullets,
              categories: project.categories,
              rating: project.rating,
              reviewCount: project.reviewCount,
            },
            preset.key,
            credentials
          ),
      readImage(project.frontCoverUrl),
      Promise.all(project.interiorImageUrls.slice(0, 4).map(readImage)).then((images) =>
        images.filter((image): image is Buffer => image !== null)
      ),
      project.aiScene
        ? generateAdScene({ title: project.title ?? '', categories: project.categories }, preset.key, credentials)
        : Promise.resolve(null),
    ])

    const script = scriptResult.data
    const formats = project.aspectRatios.length > 0 ? project.aspectRatios : DEFAULT_FORMATS

    // One render per format; each is an independent ffmpeg pipeline.
    const cuts = await Promise.all(
      formats.map(async (format) => {
        const output = await renderVideoAd({
          title: project.title ?? 'Untitled Book',
          author: project.author ?? '',
          headline: script.headline,
          benefits: script.benefits,
          ctaText: script.ctaText,
          preset: preset.key,
          format,
          length: toTrailerLength(project.length),
          coverBuffer,
          interiorBuffers,
          sceneBuffer,
          rating: project.showProof ? project.rating : null,
          reviewCount: project.showProof ? project.reviewCount : null,
          price: project.showProof ? project.price : null,
        })

        const slug = format.replace(':', 'x')
        const [video, poster] = await Promise.all([
          storeFile(
            assetPath(`videoad/${project.id}`, publisherId, `ad-${slug}`, 'video/mp4'),
            output.videoBuffer,
            'video/mp4'
          ),
          storeFile(
            assetPath(`videoad/${project.id}`, publisherId, `poster-${slug}`, 'image/png'),
            output.posterBuffer,
            'image/png'
          ),
        ])

        return {
          aspectRatio: format,
          preset: preset.key,
          videoUrl: video.url,
          posterUrl: poster.url,
          duration: Math.round(output.durationSec),
          width: output.width,
          height: output.height,
        }
      })
    )

    await prisma.$transaction([
      prisma.generatedTrailer.deleteMany({ where: { projectId: project.id } }),
      prisma.trailerProject.update({
        where: { id: project.id },
        data: {
          status: 'generated',
          adPreset: preset.key,
          adHeadline: script.headline,
          adBenefits: script.benefits,
          ctaText: script.ctaText,
          trailers: { createMany: { data: cuts } },
        },
      }),
    ])

    const warning =
      scriptResult.source === 'fallback'
        ? 'The ad copy is placeholder text — AI was unavailable. Edit the headline and benefits before running this ad.'
        : project.aiScene && !sceneBuffer
          ? 'The AI background could not be generated, so the designed template was used instead.'
          : undefined

    return NextResponse.json({ success: true, count: cuts.length, warning }, { status: 201 })
  } catch (err) {
    console.error('video ad generation failed', err)
    if (err instanceof VideoAdRenderError) {
      return NextResponse.json({ error: `Video rendering failed: ${err.message}` }, { status: 500 })
    }
    return NextResponse.json({ error: "We couldn't generate your video ads. Please try again." }, { status: 500 })
  }
}
