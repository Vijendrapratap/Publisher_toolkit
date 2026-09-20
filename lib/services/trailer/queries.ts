import { prisma } from '@/lib/db'
import type { TrailerProject, GeneratedTrailer } from '@prisma/client'
import {
  dedupeByTitle,
  LIBRARY_ROW_LIMIT,
  LIBRARY_SELECT,
  type LibraryEntry,
} from '@/lib/services/shared/library'

export function getTrailerProjectsForPublisher(
  publisherId: string,
  take = 30
): Promise<TrailerProject[]> {
  return prisma.trailerProject.findMany({
    where: { publisherId },
    orderBy: { updatedAt: 'desc' },
    take,
  })
}

export function getTrailerProjectForPublisher(
  publisherId: string,
  projectId: string
): Promise<(TrailerProject & { trailers: GeneratedTrailer[] }) | null> {
  return prisma.trailerProject.findFirst({
    where: { id: projectId, publisherId },
    include: {
      trailers: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export function getLatestTrailersForProject(
  projectId: string,
  publisherId: string
): Promise<GeneratedTrailer[]> {
  return prisma.generatedTrailer.findMany({
    where: { projectId, project: { publisherId } },
    orderBy: { createdAt: 'desc' },
  })
}

export function getGeneratedTrailerForPublisher(
  publisherId: string,
  trailerId: string
): Promise<GeneratedTrailer | null> {
  return prisma.generatedTrailer.findFirst({
    where: {
      id: trailerId,
      project: { publisherId },
    },
  })
}

export async function getPublisherTrailerBookLibrary(publisherId: string): Promise<LibraryEntry[]> {
  const [books, trailers] = await Promise.all([
    prisma.book.findMany({
      where: { publisherId },
      orderBy: { createdAt: 'desc' },
      take: LIBRARY_ROW_LIMIT,
      select: LIBRARY_SELECT,
    }),
    prisma.trailerProject.findMany({
      where: { publisherId },
      orderBy: { createdAt: 'desc' },
      take: LIBRARY_ROW_LIMIT,
      select: LIBRARY_SELECT,
    }),
  ])

  return dedupeByTitle([
    { rows: books, source: 'book' },
    { rows: trailers, source: 'trailer' },
  ])
}
