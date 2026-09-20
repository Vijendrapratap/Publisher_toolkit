import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getCreatorProjectForPublisher, updateCreatorProject } from '@/lib/services/creator/queries'
import { generateIndividualChapter } from '@/lib/services/creator/generator'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, id)

  if (!project) {
    return NextResponse.json({ error: 'Book project not found' }, { status: 404 })
  }

  const json = await req.json().catch(() => null)
  const chapterNumber = Number(json?.chapterNumber)

  if (!chapterNumber || isNaN(chapterNumber)) {
    return NextResponse.json({ error: 'Valid chapterNumber is required' }, { status: 400 })
  }

  if (project.bookType !== 'novel_chapter' || !project.content || project.content.type !== 'novel_chapter') {
    return NextResponse.json({ error: 'Project is not in chapter-by-chapter novel mode' }, { status: 400 })
  }

  const chapters = project.content.novel.chapters
  const chapterIdx = chapters.findIndex((c) => c.chapterNumber === chapterNumber)

  if (chapterIdx === -1) {
    return NextResponse.json({ error: `Chapter ${chapterNumber} not found in outline` }, { status: 404 })
  }

  const targetChapter = chapters[chapterIdx]
  const prevChapter = chapterIdx > 0 ? chapters[chapterIdx - 1] : undefined

  try {
    const credentials = await getPublisherAiCredentials(publisherId)
    const {
      data: { content, wordCount },
      source,
      reason,
    } = await generateIndividualChapter({
      bookTitle: project.title || 'Untitled Book',
      premise: project.promptConcept || project.content.novel.premise,
      chapterNumber: targetChapter.chapterNumber,
      chapterTitle: targetChapter.title,
      chapterSummary: targetChapter.summary,
      previousChapterSummary: prevChapter ? prevChapter.summary : undefined,
      styleTheme: project.styleTheme || 'thriller_suspense',
    }, credentials)

    chapters[chapterIdx] = {
      ...targetChapter,
      content,
      wordCount,
      // A placeholder is not a written chapter — leaving it 'draft' keeps the
      // outline honest about what still needs writing.
      status: source === 'ai' ? 'completed' : 'draft',
    }

    const totalWords = chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0)

    const updated = await updateCreatorProject(publisherId, id, {
      content: {
        type: 'novel_chapter',
        novel: {
          ...project.content.novel,
          chapters,
        },
      },
      wordCount: totalWords,
    })
    if (!updated) {
      return NextResponse.json({ error: 'Book project not found' }, { status: 404 })
    }

    return NextResponse.json({
      chapter: chapters[chapterIdx],
      totalWords,
      project: updated,
      source,
      reason,
    })
  } catch (err) {
    console.error('Failed to generate chapter:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate chapter'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
