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

  const slug = project.publishedSlug ?? (await allocateSlug(project.title))

  const updated = await prisma.landingProject.update({
    where: { id: project.id },
    data: { status: 'generated', publishedSlug: slug },
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

/**
 * `publishedSlug` is unique, and a random five-character suffix does collide.
 * Each attempt is checked, and the last resort cannot collide at all.
 */
async function allocateSlug(title: string | null): Promise<string> {
  const base =
    (title || 'book')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'book'

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 7)}`
    const taken = await prisma.landingProject.findUnique({
      where: { publishedSlug: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
  }

  return `${base}-${crypto.randomUUID()}`
}
