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

export async function getPublisherTrailerBookLibrary(publisherId: string) {
  const [books, trailers] = await Promise.all([
    prisma.book.findMany({
      where: { publisherId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        author: true,
        blurb: true,
        frontCoverUrl: true,
        createdAt: true,
      },
    }),
    prisma.trailerProject.findMany({
      where: { publisherId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        author: true,
        blurb: true,
        frontCoverUrl: true,
        createdAt: true,
      },
    }),
  ])

  const map = new Map<
    string,
    {
      id: string
      title: string
      author: string
      blurb: string
      frontCoverUrl: string | null
      createdAt: Date
      source: 'book' | 'trailer'
    }
  >()

  for (const b of books) {
    const key = (b.title || b.id).trim().toLowerCase()
    if (!map.has(key)) {
      map.set(key, {
        id: b.id,
        title: b.title || 'Untitled book',
        author: b.author || '',
        blurb: b.blurb || '',
        frontCoverUrl: b.frontCoverUrl,
        createdAt: b.createdAt,
        source: 'book',
      })
    } else {
      const existing = map.get(key)!
      if (!existing.frontCoverUrl && b.frontCoverUrl) {
        existing.frontCoverUrl = b.frontCoverUrl
      }
    }
  }

  for (const t of trailers) {
    const key = (t.title || t.id).trim().toLowerCase()
    if (!map.has(key)) {
      map.set(key, {
        id: t.id,
        title: t.title || 'Untitled book',
        author: t.author || '',
        blurb: t.blurb || '',
        frontCoverUrl: t.frontCoverUrl,
        createdAt: t.createdAt,
        source: 'trailer',
      })
    } else {
      const existing = map.get(key)!
      if (!existing.frontCoverUrl && t.frontCoverUrl) {
        existing.frontCoverUrl = t.frontCoverUrl
      }
    }
  }

  return Array.from(map.values())
}
