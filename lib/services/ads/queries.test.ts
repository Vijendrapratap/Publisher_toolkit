import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getBooksForPublisher, getBookForPublisher, getLatestCreativeSetForBook, getAdCopyForPublisher } from './queries'

afterEach(async () => {
  await prisma.creativeImage.deleteMany()
  await prisma.adCopy.deleteMany()
  await prisma.creativeSet.deleteMany()
  await prisma.book.deleteMany()
})

describe('book queries', () => {
  it('only returns books belonging to the given publisher', async () => {
    await prisma.book.create({ data: { publisherId: 'pub_a', pdfUrl: 'x' } })
    const bookB = await prisma.book.create({ data: { publisherId: 'pub_b', pdfUrl: 'y' } })

    expect(await getBooksForPublisher('pub_a')).toHaveLength(1)
    expect(await getBookForPublisher('pub_a', bookB.id)).toBeNull()
  })
})

describe('getLatestCreativeSetForBook', () => {
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

    const result = await getLatestCreativeSetForBook(book.id, 'pub_1')
    expect(result?.id).toBe(latest.id)
    expect(result?.adCopies).toHaveLength(1)
    expect(result?.images).toHaveLength(1)
  })

  it('returns null when the book does not belong to the given publisher', async () => {
    const book = await prisma.book.create({ data: { publisherId: 'pub_1', pdfUrl: 'x' } })
    await prisma.creativeSet.create({ data: { bookId: book.id } })
    expect(await getLatestCreativeSetForBook(book.id, 'pub_2')).toBeNull()
  })
})

describe('getAdCopyForPublisher', () => {
  it("finds a copy row only through its book's publisher", async () => {
    const book = await prisma.book.create({ data: { publisherId: 'pub_1', pdfUrl: 'x' } })
    const set = await prisma.creativeSet.create({
      data: { bookId: book.id, adCopies: { create: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] } },
      include: { adCopies: true },
    })
    const copyId = set.adCopies[0].id

    expect((await getAdCopyForPublisher('pub_1', copyId))?.id).toBe(copyId)
    expect(await getAdCopyForPublisher('pub_2', copyId)).toBeNull()
  })
})
