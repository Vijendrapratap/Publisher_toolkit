import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from './db'

// Test files run in parallel workers against one shared test database, so
// this file owns its own publisher prefix and only ever deletes its own rows.
// Wiping the tables wholesale here would race other files mid-test and fail
// them on a foreign key.
const PREFIX = 'dbtest_'
const publisherId = `${PREFIX}pub_1`

describe('database schema', () => {
  afterEach(async () => {
    const mine = { creativeSet: { book: { publisherId: { startsWith: PREFIX } } } }
    await prisma.creativeImage.deleteMany({ where: mine })
    await prisma.adCopy.deleteMany({ where: mine })
    await prisma.creativeSet.deleteMany({ where: { book: { publisherId: { startsWith: PREFIX } } } })
    await prisma.book.deleteMany({ where: { publisherId: { startsWith: PREFIX } } })
  })

  it('creates and reads a Book with a nested CreativeSet', async () => {
    const book = await prisma.book.create({
      data: {
        publisherId,
        title: 'Test Book',
        author: 'Test Author',
        pdfUrl: 'https://blob.example/test.pdf',
        creativeSets: { create: [{}] },
      },
      include: { creativeSets: true },
    })

    expect(book.title).toBe('Test Book')
    expect(book.creativeSets).toHaveLength(1)
  })
})
