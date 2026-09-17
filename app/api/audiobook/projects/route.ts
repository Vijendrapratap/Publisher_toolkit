import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { storeFile } from '@/lib/providers/storage'
import { extractBookAssets } from '@/lib/services/ads/extract'
import { parseManuscriptChapters, extractPdfManuscriptText } from '@/lib/services/audiobook/chapterParser'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'
import { listAudiobookProjectsForPublisher } from '@/lib/services/audiobook/queries'
import { prisma } from '@/lib/db'

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await listAudiobookProjectsForPublisher(publisherId)
  return NextResponse.json(projects)
}

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()

  if (request.headers.get('content-type')?.includes('application/json')) {
    const json = await request.json().catch(() => null)
    if (!json || typeof json !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const title = typeof json.title === 'string' ? json.title.slice(0, 200) : 'Untitled Audiobook'
    const author = typeof json.author === 'string' ? json.author.slice(0, 200) : ''
    const blurb = typeof json.blurb === 'string' ? json.blurb.slice(0, 2000) : ''
    const text = typeof json.manuscriptText === 'string' ? json.manuscriptText : ''

    const parsedChapters = parseManuscriptChapters(text || blurb || title)

    const project = await prisma.audiobookProject.create({
      data: {
        publisherId,
        title,
        author,
        blurb,
        status: 'uploaded',
        chapters: {
          create: parsedChapters.map((ch) => ({
            chapterNumber: ch.chapterNumber,
            title: ch.title,
            content: ch.content,
            status: 'ready',
          })),
        },
      },
      include: {
        chapters: true,
      },
    })

    return NextResponse.json({ id: project.id }, { status: 201 })
  }

  // Handle multipart/form-data upload (PDF / Covers)
  const form = await request.formData()
  const pdfFile = form.get('pdf')

  if (pdfFile !== null && !(pdfFile instanceof File)) {
    return NextResponse.json({ error: 'pdf must be a file' }, { status: 400 })
  }
  if (!pdfFile) {
    return NextResponse.json({ error: 'pdf or manuscript is required' }, { status: 400 })
  }
  if (pdfFile.size > PDF_RULE.maxBytes) {
    return NextResponse.json({ error: 'pdf exceeds the 25MB size limit' }, { status: 400 })
  }

  const pdfBytes = Buffer.from(await pdfFile.arrayBuffer())
  const { url: pdfUrl } = await storeFile(
    `audiobook/${publisherId}/${Date.now()}.pdf`,
    pdfBytes,
    'application/pdf'
  )

  const [extractedAssets, fullPdfText] = await Promise.all([
    extractBookAssets(pdfBytes),
    extractPdfManuscriptText(pdfBytes),
  ])

  let manualCover = form.get('cover')
  if (manualCover !== null && !(manualCover instanceof File)) {
    return NextResponse.json({ error: 'cover must be a file' }, { status: 400 })
  }
  if (manualCover instanceof File && manualCover.size === 0) manualCover = null

  if (manualCover) {
    if (manualCover.size > COVER_RULE.maxBytes) {
      return NextResponse.json({ error: 'cover image exceeds the 10MB size limit' }, { status: 400 })
    }
    if (!COVER_RULE.accept.includes(manualCover.type)) {
      return NextResponse.json({ error: 'cover image must be png, jpeg, or webp' }, { status: 400 })
    }
  }

  let coverUrl: string | null = null
  if (manualCover) {
    const bytes = Buffer.from(await manualCover.arrayBuffer())
    coverUrl = (await storeFile(`audiobook/${publisherId}/${Date.now()}-cover.png`, bytes, manualCover.type)).url
  } else if (extractedAssets.frontCoverPng) {
    coverUrl = (await storeFile(`audiobook/${publisherId}/${Date.now()}-cover.png`, extractedAssets.frontCoverPng, 'image/png')).url
  }

  const rawText = fullPdfText || extractedAssets.blurb || extractedAssets.title || 'Chapter 1'
  const parsedChapters = parseManuscriptChapters(rawText)

  const project = await prisma.audiobookProject.create({
    data: {
      publisherId,
      title: extractedAssets.title || 'Untitled Book',
      author: extractedAssets.author || '',
      blurb: extractedAssets.blurb || '',
      pdfUrl,
      coverUrl,
      status: 'uploaded',
      chapters: {
        create: parsedChapters.map((ch) => ({
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          content: ch.content,
          status: 'ready',
        })),
      },
    },
    include: {
      chapters: true,
    },
  })

  return NextResponse.json({ id: project.id }, { status: 201 })
}
