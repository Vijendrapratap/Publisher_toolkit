import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'
import { generateBookPdf } from '@/lib/services/creator/pdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, id)

  if (!project) {
    return NextResponse.json({ error: 'Book project not found' }, { status: 404 })
  }

  if (!project.content) {
    return NextResponse.json({ error: 'Book content has not been generated yet' }, { status: 400 })
  }

  try {
    const pdfBuffer = await generateBookPdf(project)
    const slug = (project.title || 'book')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'book'

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slug}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('Failed to generate book PDF:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate book PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
