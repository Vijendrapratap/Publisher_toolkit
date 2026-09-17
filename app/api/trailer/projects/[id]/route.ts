import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getTrailerProjectForPublisher } from '@/lib/services/trailer/queries'
import { storeFile } from '@/lib/providers/storage'
import { trailerProjectUpdateSchema } from '@/lib/services/trailer/options'
import { COVER_RULE } from '@/lib/services/ads/validation'
import { prisma } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getTrailerProjectForPublisher(publisherId, id)
  if (!project) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (request.headers.get('content-type')?.includes('application/json')) {
    const raw = await request.json().catch(() => null)
    const parsed = trailerProjectUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update' }, { status: 400 })
    }
    const update = parsed.data
    const completesConfig = Boolean(
      update.length && update.style && update.musicMood && update.aspectRatios?.length
    )
    const updated = await prisma.trailerProject.update({
      where: { id: project.id },
      data: completesConfig ? { ...update, status: 'configured' } : update,
    })
    return NextResponse.json({ id: updated.id }, { status: 200 })
  }

  const form = await request.formData()
  let frontCover = form.get('frontCover')
  let backCover = form.get('backCover')

  if (frontCover !== null && !(frontCover instanceof File)) {
    return NextResponse.json({ error: 'frontCover must be a file' }, { status: 400 })
  }
  if (backCover !== null && !(backCover instanceof File)) {
    return NextResponse.json({ error: 'backCover must be a file' }, { status: 400 })
  }
  if (frontCover instanceof File && frontCover.size === 0) frontCover = null
  if (backCover instanceof File && backCover.size === 0) backCover = null

  for (const cover of [frontCover, backCover]) {
    if (!cover) continue
    if (cover.size > COVER_RULE.maxBytes) {
      return NextResponse.json({ error: 'cover image exceeds the 10MB size limit' }, { status: 400 })
    }
    if (!COVER_RULE.accept.includes(cover.type)) {
      return NextResponse.json({ error: 'cover image must be png, jpeg, or webp' }, { status: 400 })
    }
  }
  if (!frontCover && !backCover) {
    return NextResponse.json({ error: 'frontCover or backCover is required' }, { status: 400 })
  }

  const data: { frontCoverUrl?: string; backCoverUrl?: string } = {}
  if (frontCover) {
    const bytes = Buffer.from(await frontCover.arrayBuffer())
    data.frontCoverUrl = (await storeFile(`trailer/${publisherId}/${Date.now()}-front.png`, bytes, frontCover.type)).url
  }
  if (backCover) {
    const bytes = Buffer.from(await backCover.arrayBuffer())
    data.backCoverUrl = (await storeFile(`trailer/${publisherId}/${Date.now()}-back.png`, bytes, backCover.type)).url
  }

  const updated = await prisma.trailerProject.update({ where: { id: project.id }, data })

  return NextResponse.json({ id: updated.id }, { status: 200 })
}
