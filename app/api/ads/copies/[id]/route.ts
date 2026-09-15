import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAdCopyForPublisher } from '@/lib/services/ads/queries'
import { adCopyUpdateSchema } from '@/lib/services/ads/options'
import { prisma } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const copy = await getAdCopyForPublisher(publisherId, id)
  if (!copy) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = adCopyUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid copy' }, { status: 400 })
  }

  const updated = await prisma.adCopy.update({ where: { id: copy.id }, data: parsed.data })
  return NextResponse.json({
    id: updated.id,
    headline: updated.headline,
    primaryText: updated.primaryText,
    description: updated.description,
  })
}
