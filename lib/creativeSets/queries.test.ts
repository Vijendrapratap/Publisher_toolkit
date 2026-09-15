import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getLatestCreativeSetForBook } from './queries'

describe('getLatestCreativeSetForBook', () => {
  afterEach(async () => {
    await prisma.creativeImage.deleteMany()
    await prisma.adCopy.deleteMany()
    await prisma.creativeSet.deleteMany()
    await prisma.book.deleteMany()
  })

  it('returns the most recent creative set with its copy and images', async () => {
    const book = await prisma.book.create({ data: { publisherId: 'pub_1', pdfUrl: 'x' } })
    await prisma.creativeSet.create({ data: { bookId: book.id } })
    const latest = await prisma.creativeSet.create({
      data: {
        bookId: book.id,
        adCopies: { create: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] },
        images: { create: [{ platform: 'META', sizeKey: 'meta_feed_1080x1080', width: 1080, height: 1080, imageUrl: 'https://x/img.png' }] },
      },
    })

    const result = await getLatestCreativeSetForBook(book.id)
    expect(result?.id).toBe(latest.id)
    expect(result?.adCopies).toHaveLength(1)
    expect(result?.images).toHaveLength(1)
  })
})
