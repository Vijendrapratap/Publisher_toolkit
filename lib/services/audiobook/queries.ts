import { prisma } from '@/lib/db'

export async function getAudiobookProjectForPublisher(publisherId: string, id: string) {
  return prisma.audiobookProject.findFirst({
    where: { id, publisherId },
    include: {
      chapters: {
        orderBy: { chapterNumber: 'asc' },
      },
    },
  })
}

export async function listAudiobookProjectsForPublisher(publisherId: string) {
  return prisma.audiobookProject.findMany({
    where: { publisherId },
    orderBy: { createdAt: 'desc' },
    include: {
      chapters: {
        select: { id: true, chapterNumber: true, title: true, duration: true, status: true },
        orderBy: { chapterNumber: 'asc' },
      },
    },
  })
}
