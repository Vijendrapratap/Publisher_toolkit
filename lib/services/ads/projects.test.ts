import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import type { BookCreatorProjectData } from '@/lib/services/creator/types'
import { getAdsProject, getAdsProjects, projectFieldsFromCreator, syncProjectFromCreator } from './projects'

// Shared test DB, parallel workers: this file only touches its own prefix.
const PREFIX = 'projects_'
const pub = `${PREFIX}pub`
const other = `${PREFIX}other`

afterEach(async () => {
  const mine = { creativeSet: { book: { publisherId: { startsWith: PREFIX } } } }
  await prisma.creativeImage.deleteMany({ where: mine })
  await prisma.creativeSet.deleteMany({ where: { book: { publisherId: { startsWith: PREFIX } } } })
  await prisma.book.deleteMany({ where: { publisherId: { startsWith: PREFIX }, parentBookId: { not: null } } })
  await prisma.book.deleteMany({ where: { publisherId: { startsWith: PREFIX } } })
})

function creator(over: Partial<BookCreatorProjectData> = {}): BookCreatorProjectData {
  return {
    id: `${PREFIX}cp_${Math.random().toString(36).slice(2)}`,
    publisherId: pub,
    title: 'Owl Woods',
    subtitle: null,
    author: 'Eliza',
    bookType: 'children',
    genre: null,
    targetAudience: null,
    styleTheme: null,
    difficultyLevel: null,
    promptConcept: 'A shy owl',
    coverPrompt: null,
    coverImageUrl: 'https://img/cover.png',
    status: 'generated',
    metadata: null,
    content: {
      type: 'children',
      pages: Array.from({ length: 7 }, (_, i) => ({
        pageNumber: i + 1,
        storyText: 't',
        illustrationPrompt: 'p',
        generatedImageUrl: i === 1 ? undefined : `https://img/p${i + 1}.png`,
      })),
    },
    wordCount: 0,
    pageCount: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

describe('projectFieldsFromCreator', () => {
  it('maps title, author, concept and cover, and keeps up to five drawn pages', () => {
    expect(projectFieldsFromCreator(creator())).toEqual({
      title: 'Owl Woods',
      author: 'Eliza',
      blurb: 'A shy owl',
      frontCoverUrl: 'https://img/cover.png',
      interiorImageUrls: ['https://img/p1.png', 'https://img/p3.png', 'https://img/p4.png', 'https://img/p5.png', 'https://img/p6.png'],
    })
  })

  it('has no inside pages for book types without page images', () => {
    const fields = projectFieldsFromCreator(creator({ content: null, title: null, author: null, promptConcept: null }))
    expect(fields).toMatchObject({ title: 'Untitled book', author: '', blurb: '', interiorImageUrls: [] })
  })
})

describe('syncProjectFromCreator', () => {
  it('creates the root once and updates it on later syncs', async () => {
    const cp = creator()
    const first = await syncProjectFromCreator(pub, cp)
    const second = await syncProjectFromCreator(pub, { ...cp, title: 'Owl Woods (2nd ed.)' })

    expect(second.id).toBe(first.id)
    expect(second.title).toBe('Owl Woods (2nd ed.)')
    expect(first).toMatchObject({ publisherId: pub, parentBookId: null, creatorProjectId: cp.id, contentGoal: null })
    expect(await prisma.book.count({ where: { creatorProjectId: cp.id } })).toBe(1)
  })
})

describe('getAdsProjects / getAdsProject', () => {
  async function seedProject(publisherId: string) {
    const root = await prisma.book.create({ data: { publisherId, title: 'RAG', contentGoal: 'all' } })
    const child = await prisma.book.create({ data: { publisherId, title: 'RAG', parentBookId: root.id, contentGoal: 'aplus' } })
    await prisma.creativeSet.create({
      data: { bookId: child.id, images: { create: [{ platform: 'AMAZON', sizeKey: 'amazon_aplus_banner_970x600', width: 970, height: 600, imageUrl: 'hero.png' }] } },
    })
    return { root, child }
  }

  it('returns one card per root with a summary of what exists', async () => {
    const { root } = await seedProject(pub)
    await prisma.book.create({ data: { publisherId: pub, title: 'Empty' } })

    const cards = await getAdsProjects(pub)
    expect(cards.map((c) => c.title).sort()).toEqual(['Empty', 'RAG'])
    expect(cards.find((c) => c.id === root.id)?.summary).toBe('A+ images')
    expect(cards.find((c) => c.title === 'Empty')?.summary).toBe('Nothing made yet')
  })

  it('loads a project with its grouped creations, scoped to the publisher and to roots', async () => {
    const { root, child } = await seedProject(pub)

    const project = await getAdsProject(pub, root.id)
    expect(project?.groups.aplus.latest).toMatchObject({ rowId: child.id, imageUrls: ['hero.png'] })
    expect(await getAdsProject(other, root.id)).toBeNull()
    expect(await getAdsProject(pub, child.id)).toBeNull()
  })
})
