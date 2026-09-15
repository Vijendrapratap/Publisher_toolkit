import { prisma } from '@/lib/db'

export function getLatestCreativeSetForBook(bookId: string, publisherId: string) {
  return prisma.creativeSet.findFirst({
    where: { bookId, book: { publisherId } },
    orderBy: { createdAt: 'desc' },
    include: { adCopies: true, images: true },
  })
}
