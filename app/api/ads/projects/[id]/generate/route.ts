import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { generateAdCopy, type AdPlatform } from '@/lib/services/ads/copy'
import { renderCreativeImages } from '@/lib/services/ads/render'
import { readStoredFile, storeFile, toDataUri } from '@/lib/providers/storage'
import type { CopyTone } from '@/lib/services/ads/options'
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
    const coverDataUri = toDataUri(await readStoredFile(book.frontCoverUrl))
    const [variants, renderedImages] = await Promise.all([
      generateAdCopy(details, { tone: book.copyTone as CopyTone, platforms }),
      renderCreativeImages({
        coverImageUrl: coverDataUri,
        title: details.title,
        author: details.author,
        templateKey: book.templateKey,
        platforms,
      }),
    ])

    // One editable row per selected platform, blank when AI copy failed.
    const copyRows = platforms.map(
      (platform) =>
        variants.find((v) => v.platform === platform) ?? { platform, headline: '', primaryText: '', description: '' }
    )

    const creativeSetId = crypto.randomUUID()
    const images = await Promise.all(
      renderedImages.map(async (img) => {
        const { url } = await storeFile(
          `ads/${publisherId}/creatives/${creativeSetId}/${img.sizeKey}.png`,
          img.pngBuffer,
          'image/png'
        )
        return { platform: img.platform, sizeKey: img.sizeKey, width: img.width, height: img.height, imageUrl: url }
      })
    )

    const creativeSet = await prisma.creativeSet.create({
      data: {
        id: creativeSetId,
        bookId: book.id,
        adCopies: {
          createMany: {
            data: copyRows.map(({ platform, headline, primaryText, description }) => ({
              platform,
              headline,
              primaryText,
              description,
            })),
          },
        },
        images: { createMany: { data: images } },
      },
    })
    await prisma.book.update({ where: { id: book.id }, data: { status: 'generated' } })

    return NextResponse.json({ creativeSetId: creativeSet.id }, { status: 201 })
  } catch (err) {
    console.error('ads generation failed', err)
    return NextResponse.json(
      { error: "We couldn't generate your creatives. Check your cover image and try again." },
      { status: 500 }
    )
  }
}
