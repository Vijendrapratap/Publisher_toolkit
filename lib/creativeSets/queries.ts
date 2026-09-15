import { prisma } from '@/lib/db'

export function getLatestCreativeSetForBook(bookId: string) {
  return prisma.creativeSet.findFirst({
    where: { bookId },
    orderBy: { createdAt: 'desc' },
    include: { adCopies: true, images: true },
  })
}
