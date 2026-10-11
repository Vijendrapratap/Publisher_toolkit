import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'
import { syncProjectFromCreator } from '@/lib/services/ads/projects'

export const dynamic = 'force-dynamic'

/** Opens (creating on first use) the written book's one Ads project. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, id)
  if (!project) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const root = await syncProjectFromCreator(publisherId, project)
  return NextResponse.json({ projectUrl: `/ads/books/${root.id}` })
}
