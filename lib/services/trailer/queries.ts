import { prisma } from '@/lib/db'
import type { TrailerProject, GeneratedTrailer } from '@prisma/client'

export function getTrailerProjectsForPublisher(publisherId: string): Promise<TrailerProject[]> {
  return prisma.trailerProject.findMany({
    where: { publisherId },
    orderBy: { createdAt: 'desc' },
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

export async function getLatestTrailersForProject(
  projectId: string,
  publisherId: string
): Promise<GeneratedTrailer[]> {
  const project = await prisma.trailerProject.findFirst({
    where: { id: projectId, publisherId },
    include: {
      trailers: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  return project?.trailers ?? []
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
