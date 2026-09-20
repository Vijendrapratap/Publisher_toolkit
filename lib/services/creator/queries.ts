import { prisma } from '@/lib/db'
import type { CreateBookProjectInput } from './options'
import type { GeneratedBookContent, BookCreatorProjectData } from './types'

export async function getCreatorProjectsForPublisher(publisherId: string): Promise<BookCreatorProjectData[]> {
  const projects = await prisma.bookCreatorProject.findMany({
    where: { publisherId },
    orderBy: { updatedAt: 'desc' },
  })

  return projects as unknown as BookCreatorProjectData[]
}

export async function getCreatorProjectForPublisher(
  publisherId: string,
  id: string
): Promise<BookCreatorProjectData | null> {
  const project = await prisma.bookCreatorProject.findFirst({
    where: { id, publisherId },
  })

  if (!project) return null
  return project as unknown as BookCreatorProjectData
}

export async function createCreatorProject(
  publisherId: string,
  input: CreateBookProjectInput,
  content?: GeneratedBookContent
): Promise<BookCreatorProjectData> {
  let wordCount = 0
  let pageCount = input.pageCount || 1

  if (content) {
    if (content.type === 'children' || content.type === 'coloring') {
      pageCount = content.pages.length
      wordCount = content.type === 'children'
        ? content.pages.reduce((acc, p) => acc + p.storyText.split(/\s+/).length, 0)
        : 0
    } else if (content.type === 'novel_chapter') {
      pageCount = content.novel.chapters.length
      wordCount = content.novel.chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0)
    } else if (content.type === 'short_story') {
      pageCount = 1
      wordCount = content.story.wordCount || 0
    } else if (content.type === 'word_game') {
      pageCount = content.wordSearches.length + (content.crosswords?.length || 0)
    }
  }

  const project = await prisma.bookCreatorProject.create({
    data: {
      publisherId,
      title: input.title,
      subtitle: input.subtitle || null,
      author: input.author || 'Author',
      bookType: input.bookType,
      genre: input.genre || null,
      targetAudience: input.targetAudience || 'all_ages',
      styleTheme: input.styleTheme || 'watercolor',
      difficultyLevel: input.difficultyLevel || 'medium',
      promptConcept: input.promptConcept,
      status: content ? 'generated' : 'draft',
      content: content as any,
      wordCount,
      pageCount,
    },
  })

  return project as unknown as BookCreatorProjectData
}

export async function updateCreatorProject(
  publisherId: string,
  id: string,
  data: Partial<BookCreatorProjectData>
): Promise<BookCreatorProjectData | null> {
  // Scoped by publisher, not just id: callers checking ownership first is a
  // convention, and conventions are how cross-tenant writes get in.
  const { count } = await prisma.bookCreatorProject.updateMany({
    where: { id, publisherId },
    data: {
      title: data.title,
      subtitle: data.subtitle,
      author: data.author,
      bookType: data.bookType,
      genre: data.genre,
      targetAudience: data.targetAudience,
      styleTheme: data.styleTheme,
      difficultyLevel: data.difficultyLevel,
      promptConcept: data.promptConcept,
      coverPrompt: data.coverPrompt,
      coverImageUrl: data.coverImageUrl,
      status: data.status,
      content: data.content as any,
      metadata: data.metadata as any,
      wordCount: data.wordCount,
      pageCount: data.pageCount,
    },
  })
  if (count === 0) return null

  return getCreatorProjectForPublisher(publisherId, id)
}

export async function deleteCreatorProject(publisherId: string, id: string): Promise<boolean> {
  const result = await prisma.bookCreatorProject.deleteMany({
    where: { id, publisherId },
  })

  return result.count > 0
}
