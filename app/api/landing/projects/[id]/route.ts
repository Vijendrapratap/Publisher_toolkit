import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getLandingProjectForPublisher } from '@/lib/services/landing/queries'
import { landingProjectUpdateSchema } from '@/lib/services/landing/options'
import { prisma } from '@/lib/db'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json(project)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = landingProjectUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid update' },
      { status: 400 }
    )
  }

  const updates = parsed.data
  const completesConfig = Boolean(updates.template && updates.theme && updates.ctaText)

  const updated = await prisma.landingProject.update({
    where: { id: project.id },
    data: completesConfig ? { ...updates, status: 'configured' } : updates,
  })

  return NextResponse.json({ id: updated.id }, { status: 200 })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getLandingProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await prisma.landingProject.delete({ where: { id: project.id } })
  return NextResponse.json({ success: true }, { status: 200 })
}
