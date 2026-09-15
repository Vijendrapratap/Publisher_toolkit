import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getBooksForPublisher, getBookForPublisher } from './queries'

describe('book queries', () => {
  afterEach(async () => {
    await prisma.book.deleteMany()
  })

  it('only returns books belonging to the given publisher', async () => {
    await prisma.book.create({ data: { publisherId: 'pub_a', pdfUrl: 'x' } })
    const bookB = await prisma.book.create({ data: { publisherId: 'pub_b', pdfUrl: 'y' } })

    const listA = await getBooksForPublisher('pub_a')
    expect(listA).toHaveLength(1)

    const foundAcrossTenant = await getBookForPublisher('pub_a', bookB.id)
    expect(foundAcrossTenant).toBeNull()
  })
})
