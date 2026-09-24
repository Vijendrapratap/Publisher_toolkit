import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { createBookProjectSchema } from '@/lib/services/creator/options'
import { generateBookProjectContent } from '@/lib/services/creator/generator'
import { createCreatorProject, getCreatorProjectsForPublisher } from '@/lib/services/creator/queries'
import { chargeCredits, creditErrorResponse } from '@/lib/credits/charge'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getCreatorProjectsForPublisher(publisherId)
  return NextResponse.json({ projects })
}

export async function POST(req: Request) {
  const publisherId = await requireCurrentPublisherId()
  const json = await req.json().catch(() => null)

  const parsed = createBookProjectSchema.safeParse(json)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return NextResponse.json({ error: firstIssue?.message || 'Invalid book project input' }, { status: 400 })
  }

  try {
    const payload = await chargeCredits(
      { userId: publisherId, action: 'creator.generate' },
      async () => {
        const { data: content, source, reason } = await generateBookProjectContent(parsed.data)
        const project = await createCreatorProject(publisherId, parsed.data, content)

        // `source` lets the studio tell the publisher they are looking at sample
        // content rather than their concept, instead of passing it off as theirs.
        return {
          result: { id: project.id, project, source, reason },
          usedUnits: source === 'fallback' ? 0 : undefined,
        }
      }
    )
    return NextResponse.json(payload, { status: 201 })
  } catch (err) {
    const creditResponse = creditErrorResponse(err)
    if (creditResponse) return creditResponse
    console.error('Failed to create book project:', err)
    const message = err instanceof Error ? err.message : 'Failed to create book project'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
