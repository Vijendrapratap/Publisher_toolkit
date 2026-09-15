import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { storeFile } from '@/lib/providers/storage'
import { extractBookAssets } from '@/lib/services/ads/extract'
import { prisma } from '@/lib/db'

const MAX_PDF_BYTES = 25 * 1024 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_COVER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  const form = await request.formData()

  const pdfFile = form.get('pdf')
  if (pdfFile !== null && !(pdfFile instanceof File)) {
    return NextResponse.json({ error: 'pdf must be a file' }, { status: 400 })
  }
  if (!pdfFile) {
    return NextResponse.json({ error: 'pdf is required' }, { status: 400 })
  }
  if (pdfFile.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'pdf exceeds the 25MB size limit' }, { status: 400 })
  }
  const pdfBytes = Buffer.from(await pdfFile.arrayBuffer())
  const { url: pdfUrl } = await storeFile(`ads/${publisherId}/${Date.now()}.pdf`, pdfBytes, 'application/pdf')

  const extracted = await extractBookAssets(pdfBytes)

  let manualFrontCover = form.get('frontCover')
  let manualBackCover = form.get('backCover')
  if (manualFrontCover !== null && !(manualFrontCover instanceof File)) {
    return NextResponse.json({ error: 'frontCover must be a file' }, { status: 400 })
  }
  if (manualBackCover !== null && !(manualBackCover instanceof File)) {
    return NextResponse.json({ error: 'backCover must be a file' }, { status: 400 })
  }
  // An unselected <input type="file"> still submits as a zero-byte File — treat it as absent.
  if (manualFrontCover instanceof File && manualFrontCover.size === 0) manualFrontCover = null
  if (manualBackCover instanceof File && manualBackCover.size === 0) manualBackCover = null
  for (const cover of [manualFrontCover, manualBackCover]) {
    if (!cover) continue
    if (cover.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'cover image exceeds the 10MB size limit' }, { status: 400 })
    }
    if (!ALLOWED_COVER_TYPES.has(cover.type)) {
      return NextResponse.json({ error: 'cover image must be png, jpeg, or webp' }, { status: 400 })
    }
  }

  let frontCoverUrl: string | null = null
  if (manualFrontCover) {
    const bytes = Buffer.from(await manualFrontCover.arrayBuffer())
    frontCoverUrl = (await storeFile(`ads/${publisherId}/${Date.now()}-front.png`, bytes, manualFrontCover.type)).url
  } else if (extracted.frontCoverPng) {
    frontCoverUrl = (await storeFile(`ads/${publisherId}/${Date.now()}-front.png`, extracted.frontCoverPng, 'image/png')).url
  }

  let backCoverUrl: string | null = null
  if (manualBackCover) {
    const bytes = Buffer.from(await manualBackCover.arrayBuffer())
    backCoverUrl = (await storeFile(`ads/${publisherId}/${Date.now()}-back.png`, bytes, manualBackCover.type)).url
  } else if (extracted.backCoverPng) {
    backCoverUrl = (await storeFile(`ads/${publisherId}/${Date.now()}-back.png`, extracted.backCoverPng, 'image/png')).url
  }

  const book = await prisma.book.create({
    data: {
      publisherId,
      title: extracted.title,
      author: extracted.author,
      blurb: extracted.blurb,
      pdfUrl,
      frontCoverUrl,
      backCoverUrl,
    },
  })

  return NextResponse.json(
    { id: book.id, needsManualCover: !frontCoverUrl },
    { status: 201 }
  )
}
