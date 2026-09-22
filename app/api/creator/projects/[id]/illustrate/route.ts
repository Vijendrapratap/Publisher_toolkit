import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { isAiConfigured } from '@/lib/providers/ai'
import { getCreatorProjectForPublisher, updateCreatorProject } from '@/lib/services/creator/queries'
import { illustrateProject } from '@/lib/services/creator/illustrate'

export const dynamic = 'force-dynamic'
// Image generation is the longest job in the app: a 20-page coloring book is
// 21 model calls, three at a time.
export const maxDuration = 300

const bodySchema = z.object({ regenerate: z.boolean().optional() })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'Book project not found' }, { status: 404 })
  }
  if (!project.content) {
    return NextResponse.json({ error: 'Generate the book content before illustrating it.' }, { status: 400 })
  }

  const credentials = await getPublisherAiCredentials(publisherId)
  if (!isAiConfigured({ apiKey: credentials.apiKey })) {
    return NextResponse.json(
      { error: 'Add an OpenRouter API key in Settings to generate illustrations.' },
      { status: 400 }
    )
  }

  const { regenerate } = bodySchema.parse((await request.json().catch(() => ({}))) ?? {})

  try {
    const result = await illustrateProject(
      {
        projectId: project.id,
        publisherId,
        title: project.title || 'Untitled Book',
        styleTheme: project.styleTheme || 'watercolor storybook',
        content: project.content,
        regenerate,
        existingCoverUrl: project.coverImageUrl,
      },
      credentials
    )

    // Persist whatever succeeded: a partial set of illustrations is still worth
    // keeping, and re-running fills only the gaps.
    const updated = await updateCreatorProject(publisherId, id, {
      content: result.content,
      coverImageUrl: result.coverImageUrl ?? project.coverImageUrl,
      status: result.failures.length === 0 ? 'illustrated' : project.status,
    })
    if (!updated) {
      return NextResponse.json({ error: 'Book project not found' }, { status: 404 })
    }

    return NextResponse.json({
      project: updated,
      requested: result.requested,
      succeeded: result.succeeded,
      failures: result.failures,
    })
  } catch (err) {
    console.error('Failed to illustrate book project:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate illustrations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
