import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { createBookProjectSchema } from '@/lib/services/creator/options'
import { generateBookProjectContent } from '@/lib/services/creator/generator'
import { createCreatorProject, getCreatorProjectsForPublisher } from '@/lib/services/creator/queries'

export const dynamic = 'force-dynamic'

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
    const generatedContent = await generateBookProjectContent(parsed.data)
    const project = await createCreatorProject(publisherId, parsed.data, generatedContent)

    return NextResponse.json({ id: project.id, project }, { status: 201 })
  } catch (err: any) {
    console.error('Failed to create book project:', err)
    return NextResponse.json({ error: err.message || 'Failed to create book project' }, { status: 500 })
  }
}
