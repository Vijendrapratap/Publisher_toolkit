import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAudiobookProjectForPublisher } from '@/lib/services/audiobook/queries'
import { audiobookProjectUpdateSchema } from '@/lib/services/audiobook/options'
import { prisma } from '@/lib/db'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json(project)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = audiobookProjectUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid update' },
      { status: 400 }
    )
  }

  const { chapters, ...projectUpdates } = parsed.data

  // If chapters were provided, update them in transaction
  if (chapters && chapters.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Remove previous chapters and recreate with updated order/content
      await tx.audiobookChapter.deleteMany({ where: { projectId: project.id } })
      await tx.audiobookChapter.createMany({
        data: chapters.map((ch, idx) => ({
          projectId: project.id,
          chapterNumber: ch.chapterNumber || idx + 1,
          title: ch.title,
          content: ch.content,
          status: 'ready',
        })),
      })
    })
  }

  const completesConfig = Boolean(
    projectUpdates.voiceModel && projectUpdates.ttsProvider && projectUpdates.audioFormat
  )

  const updated = await prisma.audiobookProject.update({
    where: { id: project.id },
    data: completesConfig ? { ...projectUpdates, status: 'configured' } : projectUpdates,
  })

  return NextResponse.json({ id: updated.id }, { status: 200 })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAudiobookProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await prisma.audiobookProject.delete({ where: { id: project.id } })
  return NextResponse.json({ success: true }, { status: 200 })
}
