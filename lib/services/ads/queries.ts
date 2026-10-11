import { prisma } from '@/lib/db'
import type { Book, AdCopy } from '@prisma/client'

export function getBookForPublisher(publisherId: string, bookId: string): Promise<Book | null> {
  return prisma.book.findFirst({ where: { id: bookId, publisherId } })
}

export function countBooksForPublisher(publisherId: string): Promise<number> {
  return prisma.book.count({ where: { publisherId } })
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

export async function getCampaignsForBook(publisherId: string, bookId: string): Promise<Book[]> {
  const target = await prisma.book.findFirst({
    where: { id: bookId, publisherId },
    select: { id: true, parentBookId: true },
  })
  if (!target) return []
  const rootId = target.parentBookId ?? target.id
  return prisma.book.findMany({
    where: { publisherId, OR: [{ id: rootId }, { parentBookId: rootId }] },
    orderBy: { createdAt: 'desc' },
  })
}
