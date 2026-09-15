import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/auth'
import { uploadToBlob } from '@/lib/blob'
import { extractBookAssets } from '@/lib/pdf/extract'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  const form = await request.formData()

  const pdfFile = form.get('pdf') as File | null
  if (!pdfFile) {
    return NextResponse.json({ error: 'pdf is required' }, { status: 400 })
  }
  const pdfBytes = Buffer.from(await pdfFile.arrayBuffer())
  const { url: pdfUrl } = await uploadToBlob(`books/${publisherId}/${Date.now()}.pdf`, pdfBytes, 'application/pdf')

  const extracted = await extractBookAssets(pdfBytes)

  const manualFrontCover = form.get('frontCover') as File | null
  const manualBackCover = form.get('backCover') as File | null

  let frontCoverUrl: string | null = null
  if (manualFrontCover) {
    const bytes = Buffer.from(await manualFrontCover.arrayBuffer())
    frontCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-front.png`, bytes, manualFrontCover.type)).url
  } else if (extracted.frontCoverPng) {
    frontCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-front.png`, extracted.frontCoverPng, 'image/png')).url
  }

  let backCoverUrl: string | null = null
  if (manualBackCover) {
    const bytes = Buffer.from(await manualBackCover.arrayBuffer())
    backCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-back.png`, bytes, manualBackCover.type)).url
  } else if (extracted.backCoverPng) {
    backCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-back.png`, extracted.backCoverPng, 'image/png')).url
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
