import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getRecentCreatorProjects } from './queries'

// Shared test DB, parallel workers: this file only touches its own prefix.
const PREFIX = 'creator_queries_'
const pub = `${PREFIX}pub`

afterEach(async () => {
  await prisma.bookCreatorProject.deleteMany({ where: { publisherId: { startsWith: PREFIX } } })
})

describe('getRecentCreatorProjects', () => {
  it('returns the newest books without their content, capped and scoped to the publisher', async () => {
    const big = { type: 'children', pages: [{ pageNumber: 1, storyText: 'x'.repeat(5000), illustrationPrompt: 'p' }] }
    await prisma.bookCreatorProject.create({ data: { publisherId: pub, title: 'Older', content: big, updatedAt: new Date('2026-01-01') } })
    const newest = await prisma.bookCreatorProject.create({ data: { publisherId: pub, title: 'Newest', content: big } })
    await prisma.bookCreatorProject.create({ data: { publisherId: `${PREFIX}other`, title: 'Not mine' } })

    const recent = await getRecentCreatorProjects(pub, 1)
    expect(recent).toEqual([{ id: newest.id, title: 'Newest', coverImageUrl: null, updatedAt: expect.any(Date) }])
  })
})
