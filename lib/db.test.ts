import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from './db'

describe('database schema', () => {
  afterEach(async () => {
    await prisma.creativeImage.deleteMany()
    await prisma.adCopy.deleteMany()
    await prisma.creativeSet.deleteMany()
    await prisma.book.deleteMany()
  })

  it('creates and reads a Book with a nested CreativeSet', async () => {
    const book = await prisma.book.create({
      data: {
        publisherId: 'pub_1',
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
