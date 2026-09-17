import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { prisma } from '@/lib/db'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Generate a clean SEO-friendly slug
  let slug = project.publishedSlug
  if (!slug) {
    const baseSlug =
      (project.title || 'book')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'book'

    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
  }

  const updated = await prisma.landingProject.update({
    where: { id: project.id },
    data: {
      status: 'generated',
      publishedSlug: slug,
    },
  })

  return NextResponse.json(
    {
      success: true,
      publishedSlug: updated.publishedSlug,
      publicUrl: `/p/${updated.publishedSlug}`,
    },
    { status: 201 }
  )
}
