import { prisma } from '@/lib/db'

export async function getLandingProjectForPublisher(publisherId: string, id: string) {
  return prisma.landingProject.findFirst({
    where: { id, publisherId },
  })
}

export async function getLandingProjectBySlug(slug: string) {
  return prisma.landingProject.findUnique({
    where: { publishedSlug: slug },
  })
}

export async function listLandingProjectsForPublisher(publisherId: string) {
  return prisma.landingProject.findMany({
    where: { publisherId },
    orderBy: { createdAt: 'desc' },
  })
}
