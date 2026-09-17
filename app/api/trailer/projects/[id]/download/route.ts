import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { buildTrailerZip, zipFileName } from '@/lib/services/trailer/zip'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (!project.trailers || project.trailers.length === 0) {
    return NextResponse.json({ error: 'Nothing generated yet' }, { status: 404 })
  }

  const buffer = await buildTrailerZip({
    title: project.title ?? '',
    author: project.author,
    blurb: project.blurb,
    length: project.length,
    style: project.style,
    musicMood: project.musicMood,
    trailers: project.trailers,
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFileName(project.title ?? '')}"`,
    },
  })
}
