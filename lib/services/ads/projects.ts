import { prisma } from '@/lib/db'
import type { Book, Prisma } from '@prisma/client'
import type { BookCreatorProjectData } from '@/lib/services/creator/types'
import { groupProjectAssets, summarizeProject, type AssetGroup, type AssetKind, type ProjectRow } from './projectAssets'

const INTERIOR_IMAGE_LIMIT = 5
// ponytail: newest roots by their own updatedAt; a root whose only recent activity is a
// child can fall past the cap. Touch the root on child changes if this list grows large.
const PROJECT_LIMIT = 60

const ROW_SELECT = {
  id: true,
  parentBookId: true,
  contentGoal: true,
  createdAt: true,
  updatedAt: true,
  creativeSets: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      createdAt: true,
      videoUrl: true,
      videoPosterUrl: true,
      videoDuration: true,
      images: { select: { imageUrl: true, sizeKey: true } },
    },
  },
  aiVideoJobs: {
    where: { status: 'completed', videoUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { videoUrl: true, posterUrl: true, createdAt: true },
  },
} satisfies Prisma.BookSelect

type SelectedRow = Prisma.BookGetPayload<{ select: typeof ROW_SELECT }>

function toProjectRow(r: SelectedRow): ProjectRow {
  return { id: r.id, contentGoal: r.contentGoal, createdAt: r.createdAt, set: r.creativeSets[0] ?? null, aiVideo: r.aiVideoJobs[0] ?? null }
}

export function projectFieldsFromCreator(creator: BookCreatorProjectData) {
  const pages =
    creator.content && (creator.content.type === 'children' || creator.content.type === 'coloring') ? creator.content.pages : []
  return {
    title: creator.title || 'Untitled book',
    author: creator.author || '',
    blurb: creator.promptConcept || '',
    frontCoverUrl: creator.coverImageUrl,
    interiorImageUrls: pages
      .flatMap((p) => (p.generatedImageUrl ? [p.generatedImageUrl] : []))
      .slice(0, INTERIOR_IMAGE_LIMIT),
  }
}

/**
 * The written book's one Ads project, created on first use and refreshed after —
 * so every creation copies the latest cover and pages. Callers must have
 * loaded `creator` scoped to `publisherId`.
 */
export function syncProjectFromCreator(publisherId: string, creator: BookCreatorProjectData): Promise<Book> {
  const fields = projectFieldsFromCreator(creator)
  return prisma.book.upsert({
    where: { creatorProjectId: creator.id },
    update: fields,
    create: { ...fields, publisherId, creatorProjectId: creator.id, contentGoal: null, platforms: ['AMAZON'] },
  })
}

export interface AdsProjectCard {
  id: string
  title: string
  author: string
  coverUrl: string | null
  summary: string
  activityAt: Date
}

export async function getAdsProjects(publisherId: string): Promise<AdsProjectCard[]> {
  const roots = await prisma.book.findMany({
    where: { publisherId, parentBookId: null },
    orderBy: { updatedAt: 'desc' },
    take: PROJECT_LIMIT,
    select: { id: true, title: true, author: true, frontCoverUrl: true },
  })
  if (roots.length === 0) return []

  const ids = roots.map((r) => r.id)
  const rows = await prisma.book.findMany({
    where: { publisherId, OR: [{ id: { in: ids } }, { parentBookId: { in: ids } }] },
    select: ROW_SELECT,
  })
  const byRoot = new Map<string, SelectedRow[]>()
  for (const r of rows) {
    const rootId = r.parentBookId ?? r.id
    byRoot.set(rootId, [...(byRoot.get(rootId) ?? []), r])
  }

  return roots
    .map((root) => {
      const own = byRoot.get(root.id) ?? []
      return {
        id: root.id,
        title: root.title || 'Untitled book',
        author: root.author || '',
        coverUrl: root.frontCoverUrl,
        summary: summarizeProject(groupProjectAssets(own.map(toProjectRow))),
        activityAt: new Date(Math.max(...own.map((r) => r.updatedAt.getTime()))),
      }
    })
    .sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime())
}

export interface AdsProject {
  root: Book
  groups: Record<AssetKind, AssetGroup>
}

/** Null for another publisher's book and for child (creation) rows — only roots are projects. */
export async function getAdsProject(publisherId: string, rootId: string): Promise<AdsProject | null> {
  const root = await prisma.book.findFirst({ where: { id: rootId, publisherId, parentBookId: null } })
  if (!root) return null
  const rows = await prisma.book.findMany({
    where: { publisherId, OR: [{ id: root.id }, { parentBookId: root.id }] },
    select: ROW_SELECT,
  })
  return { root, groups: groupProjectAssets(rows.map(toProjectRow)) }
}
