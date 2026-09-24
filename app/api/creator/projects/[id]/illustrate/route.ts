import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { isAiConfigured } from '@/lib/providers/ai'
import { getCreatorProjectForPublisher, updateCreatorProject } from '@/lib/services/creator/queries'
import { countIllustrationRequests, illustrateProject } from '@/lib/services/creator/illustrate'
import { chargeCredits, creditErrorResponse } from '@/lib/credits/charge'

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
  const content = project.content
  if (!content) {
    return NextResponse.json({ error: 'Generate the book content before illustrating it.' }, { status: 400 })
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'Illustrations are not available right now.' }, { status: 400 })
  }

  const { regenerate } = bodySchema.parse((await request.json().catch(() => ({}))) ?? {})

  const styleTheme = project.styleTheme || 'watercolor storybook'
  const requested = countIllustrationRequests({
    content,
    styleTheme,
    regenerate,
    existingCoverUrl: project.coverImageUrl,
  })

  const runIllustration = async () => {
    const result = await illustrateProject({
      projectId: project.id,
      publisherId,
      title: project.title || 'Untitled Book',
      styleTheme,
      content,
      regenerate,
      existingCoverUrl: project.coverImageUrl,
    })

    // Persist whatever succeeded: a partial set of illustrations is still worth
    // keeping, and re-running fills only the gaps.
    const updated = await updateCreatorProject(publisherId, id, {
      content: result.content,
      coverImageUrl: result.coverImageUrl ?? project.coverImageUrl,
      status: result.failures.length === 0 ? 'illustrated' : project.status,
    })
    if (!updated) {
      return { response: NextResponse.json({ error: 'Book project not found' }, { status: 404 }) }
    }

    return {
      response: NextResponse.json({
        project: updated,
        requested: result.requested,
        succeeded: result.succeeded,
        failures: result.failures,
      }),
      usedUnits: result.succeeded,
    }
  }

  try {
    // Nothing left to draw (every page already has art, cover kept) — no work,
    // so nothing to charge for.
    if (requested === 0) {
      const { response } = await runIllustration()
      return response
    }

    const response = await chargeCredits(
      { userId: publisherId, action: 'creator.illustrate', units: requested, refId: project.id },
      async () => {
        const out = await runIllustration()
        return { result: out.response, usedUnits: out.usedUnits }
      }
    )
    return response
  } catch (err) {
    const creditResponse = creditErrorResponse(err)
    if (creditResponse) return creditResponse
    console.error('Failed to illustrate book project:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate illustrations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
