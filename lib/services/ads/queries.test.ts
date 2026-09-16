import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getBooksForPublisher, getBookForPublisher, getLatestCreativeSetForBook, getAdCopyForPublisher } from './queries'

// Test files run in parallel workers against one shared test database, so this
// file owns its own publisher prefix and only ever deletes its own rows. Wiping
// the tables wholesale here would race other files mid-test and fail them on a
// foreign key.
const PREFIX = 'queries_'
const pubA = `${PREFIX}pub_a`
const pubB = `${PREFIX}pub_b`
const pub1 = `${PREFIX}pub_1`
const pub2 = `${PREFIX}pub_2`

afterEach(async () => {
  const mine = { creativeSet: { book: { publisherId: { startsWith: PREFIX } } } }
  await prisma.creativeImage.deleteMany({ where: mine })
  await prisma.adCopy.deleteMany({ where: mine })
  await prisma.creativeSet.deleteMany({ where: { book: { publisherId: { startsWith: PREFIX } } } })
  await prisma.book.deleteMany({ where: { publisherId: { startsWith: PREFIX } } })
})

describe('book queries', () => {
  it('only returns books belonging to the given publisher', async () => {
    await prisma.book.create({ data: { publisherId: pubA, pdfUrl: 'x' } })
    const bookB = await prisma.book.create({ data: { publisherId: pubB, pdfUrl: 'y' } })

    expect(await getBooksForPublisher(pubA)).toHaveLength(1)
    expect(await getBookForPublisher(pubA, bookB.id)).toBeNull()
  })
})

describe('getLatestCreativeSetForBook', () => {
  it('returns the most recent creative set with its copy and images', async () => {
    const book = await prisma.book.create({ data: { publisherId: pub1, pdfUrl: 'x' } })
    await prisma.creativeSet.create({ data: { bookId: book.id } })
    const latest = await prisma.creativeSet.create({
      data: {
        bookId: book.id,
        adCopies: { create: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] },
        images: { create: [{ platform: 'META', sizeKey: 'meta_feed_1080x1080', width: 1080, height: 1080, imageUrl: 'https://x/img.png' }] },
      },
    })

    const result = await getLatestCreativeSetForBook(book.id, pub1)
    expect(result?.id).toBe(latest.id)
    expect(result?.adCopies).toHaveLength(1)
    expect(result?.images).toHaveLength(1)
  })

  it('returns null when the book does not belong to the given publisher', async () => {
    const book = await prisma.book.create({ data: { publisherId: pub1, pdfUrl: 'x' } })
    await prisma.creativeSet.create({ data: { bookId: book.id } })
    expect(await getLatestCreativeSetForBook(book.id, pub2)).toBeNull()
  })
})

describe('getAdCopyForPublisher', () => {
  it("finds a copy row only through its book's publisher", async () => {
    const book = await prisma.book.create({ data: { publisherId: pub1, pdfUrl: 'x' } })
    const set = await prisma.creativeSet.create({
      data: { bookId: book.id, adCopies: { create: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] } },
      include: { adCopies: true },
    })
    const copyId = set.adCopies[0].id

    expect((await getAdCopyForPublisher(pub1, copyId))?.id).toBe(copyId)
    expect(await getAdCopyForPublisher(pub2, copyId)).toBeNull()
  })
})
