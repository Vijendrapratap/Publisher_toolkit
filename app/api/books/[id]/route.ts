import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/auth'
import { getBookForPublisher } from '@/lib/books/queries'
import { uploadToBlob } from '@/lib/blob'
import { prisma } from '@/lib/db'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_COVER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const form = await request.formData()
  const frontCover = form.get('frontCover')
  const backCover = form.get('backCover')

  if (frontCover !== null && !(frontCover instanceof File)) {
    return NextResponse.json({ error: 'frontCover must be a file' }, { status: 400 })
  }
  if (backCover !== null && !(backCover instanceof File)) {
    return NextResponse.json({ error: 'backCover must be a file' }, { status: 400 })
  }
  for (const cover of [frontCover, backCover]) {
    if (!cover) continue
    if (cover.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'cover image exceeds the 10MB size limit' }, { status: 400 })
    }
    if (!ALLOWED_COVER_TYPES.has(cover.type)) {
      return NextResponse.json({ error: 'cover image must be png, jpeg, or webp' }, { status: 400 })
    }
  }
  if (!frontCover && !backCover) {
    return NextResponse.json({ error: 'frontCover or backCover is required' }, { status: 400 })
  }

  const data: { frontCoverUrl?: string; backCoverUrl?: string } = {}
  if (frontCover) {
    const bytes = Buffer.from(await frontCover.arrayBuffer())
    data.frontCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-front.png`, bytes, frontCover.type)).url
  }
  if (backCover) {
    const bytes = Buffer.from(await backCover.arrayBuffer())
    data.backCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-back.png`, bytes, backCover.type)).url
  }

  const updated = await prisma.book.update({ where: { id: book.id }, data })

  return NextResponse.json({ id: updated.id }, { status: 200 })
}
