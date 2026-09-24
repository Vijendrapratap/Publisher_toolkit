import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getCreatorProjectForPublisher, updateCreatorProject } from '@/lib/services/creator/queries'
import { generateIndividualChapter } from '@/lib/services/creator/generator'
import { chargeCredits, creditErrorResponse } from '@/lib/credits/charge'

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

  const content = project.content
  if (project.bookType !== 'novel_chapter' || !content || content.type !== 'novel_chapter') {
    return NextResponse.json({ error: 'Project is not in chapter-by-chapter novel mode' }, { status: 400 })
  }

  const chapters = content.novel.chapters
  const chapterIdx = chapters.findIndex((c) => c.chapterNumber === chapterNumber)

  if (chapterIdx === -1) {
    return NextResponse.json({ error: `Chapter ${chapterNumber} not found in outline` }, { status: 404 })
  }

  const targetChapter = chapters[chapterIdx]
  const prevChapter = chapterIdx > 0 ? chapters[chapterIdx - 1] : undefined

  const runGeneration = async () => {
    const {
      data: { content: chapterText, wordCount },
      source,
      reason,
    } = await generateIndividualChapter({
      bookTitle: project.title || 'Untitled Book',
      premise: project.promptConcept || content.novel.premise,
      chapterNumber: targetChapter.chapterNumber,
      chapterTitle: targetChapter.title,
      chapterSummary: targetChapter.summary,
      previousChapterSummary: prevChapter ? prevChapter.summary : undefined,
      styleTheme: project.styleTheme || 'thriller_suspense',
    })

    chapters[chapterIdx] = {
      ...targetChapter,
      content: chapterText,
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
          ...content.novel,
          chapters,
        },
      },
      wordCount: totalWords,
    })
    if (!updated) {
      return { response: NextResponse.json({ error: 'Book project not found' }, { status: 404 }) }
    }

    return {
      response: NextResponse.json({
        chapter: chapters[chapterIdx],
        totalWords,
        project: updated,
        source,
        reason,
      }),
      usedUnits: source === 'fallback' ? 0 : undefined,
    }
  }

  try {
    const payload = await chargeCredits(
      { userId: publisherId, action: 'creator.generate', refId: project.id },
      async () => {
        const out = await runGeneration()
        return { result: out.response, usedUnits: out.usedUnits }
      }
    )
    return payload
  } catch (err) {
    const creditResponse = creditErrorResponse(err)
    if (creditResponse) return creditResponse
    console.error('Failed to generate chapter:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate chapter'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
