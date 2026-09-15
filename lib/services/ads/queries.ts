import { prisma } from '@/lib/db'
import type { Book, AdCopy } from '@prisma/client'

export function getBooksForPublisher(publisherId: string): Promise<Book[]> {
  return prisma.book.findMany({ where: { publisherId }, orderBy: { createdAt: 'desc' } })
}

export function getBookForPublisher(publisherId: string, bookId: string): Promise<Book | null> {
  return prisma.book.findFirst({ where: { id: bookId, publisherId } })
}

export function getLatestCreativeSetForBook(bookId: string, publisherId: string) {
  return prisma.creativeSet.findFirst({
    where: { bookId, book: { publisherId } },
    orderBy: { createdAt: 'desc' },
    include: { adCopies: true, images: true },
  })
}

export function getAdCopyForPublisher(publisherId: string, copyId: string): Promise<AdCopy | null> {
  return prisma.adCopy.findFirst({ where: { id: copyId, creativeSet: { book: { publisherId } } } })
}
