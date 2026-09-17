import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  getTrailerProjectsForPublisher,
  getTrailerProjectForPublisher,
  getLatestTrailersForProject,
  getGeneratedTrailerForPublisher,
} from './queries'

const PREFIX = 'trailer_queries_'
const pubA = `${PREFIX}pub_a`
const pubB = `${PREFIX}pub_b`
const pub1 = `${PREFIX}pub_1`
const pub2 = `${PREFIX}pub_2`

afterEach(async () => {
  const mine = { project: { publisherId: { startsWith: PREFIX } } }
  await prisma.generatedTrailer.deleteMany({ where: mine })
  await prisma.trailerProject.deleteMany({ where: { publisherId: { startsWith: PREFIX } } })
})

describe('trailer queries', () => {
  it('only returns projects belonging to the given publisher', async () => {
    await prisma.trailerProject.create({
      data: { publisherId: pubA, title: 'Project A', pdfUrl: 'https://example.com/a.pdf' },
    })
    const projB = await prisma.trailerProject.create({
      data: { publisherId: pubB, title: 'Project B', pdfUrl: 'https://example.com/b.pdf' },
    })

    const projectsA = await getTrailerProjectsForPublisher(pubA)
    expect(projectsA).toHaveLength(1)
    expect(projectsA[0].title).toBe('Project A')

    expect(await getTrailerProjectForPublisher(pubA, projB.id)).toBeNull()
  })

  it('retrieves project with trailers included', async () => {
    const project = await prisma.trailerProject.create({
      data: {
        publisherId: pub1,
        title: 'Sci-Fi Novel',
        trailers: {
          create: [
            {
              aspectRatio: '9:16',
              videoUrl: 'https://example.com/trailer-9x16.mp4',
              posterUrl: 'https://example.com/poster-9x16.png',
              duration: 30,
              width: 1080,
              height: 1920,
            },
          ],
        },
      },
    })

    const fetched = await getTrailerProjectForPublisher(pub1, project.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.title).toBe('Sci-Fi Novel')
    expect(fetched?.trailers).toHaveLength(1)
    expect(fetched?.trailers[0].aspectRatio).toBe('9:16')

    const trailers = await getLatestTrailersForProject(project.id, pub1)
    expect(trailers).toHaveLength(1)
    expect(trailers[0].width).toBe(1080)
  })

  it('retrieves specific generated trailer scoped to publisher', async () => {
    const project = await prisma.trailerProject.create({
      data: { publisherId: pub1, title: 'Fantasy Book' },
    })
    const trailer = await prisma.generatedTrailer.create({
      data: {
        projectId: project.id,
        aspectRatio: '16:9',
        videoUrl: 'https://example.com/trailer-16x9.mp4',
        posterUrl: 'https://example.com/poster-16x9.png',
        duration: 15,
        width: 1920,
        height: 1080,
      },
    })

    expect((await getGeneratedTrailerForPublisher(pub1, trailer.id))?.id).toBe(trailer.id)
    expect(await getGeneratedTrailerForPublisher(pub2, trailer.id)).toBeNull()
  })
})
