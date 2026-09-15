import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/auth'
import { getBookForPublisher } from '@/lib/books/queries'
import { generateAdCopy } from '@/lib/ai/generateAdCopy'
import { renderCreativeImages } from '@/lib/compositing/renderCreativeImages'
import { uploadToBlob } from '@/lib/blob'
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
    return NextResponse.json({ error: 'book has no cover image' }, { status: 400 })
  }

  const [adCopyVariants, renderedImages] = await Promise.all([
    generateAdCopy({ title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '' }),
    renderCreativeImages({ coverImageUrl: book.frontCoverUrl, title: book.title ?? '', author: book.author ?? '' }),
  ])

  const creativeSetId = crypto.randomUUID()

  const uploadedImages = await Promise.all(
    renderedImages.map(async (img) => {
      const { url } = await uploadToBlob(
        `creatives/${creativeSetId}/${img.sizeKey}.png`,
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
          data: adCopyVariants.map((v) => ({
            platform: v.platform,
            headline: v.headline,
            primaryText: v.primaryText,
            description: v.description,
          })),
        },
      },
      images: { createMany: { data: uploadedImages } },
    },
  })

  return NextResponse.json({ creativeSetId: creativeSet.id }, { status: 201 })
}
