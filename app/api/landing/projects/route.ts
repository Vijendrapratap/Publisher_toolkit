import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { storeFile } from '@/lib/providers/storage'
import { extractBookAssets } from '@/lib/services/ads/extract'
import { extractPdfManuscriptText } from '@/lib/services/audiobook/chapterParser'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'
import { listLandingProjectsForPublisher } from '@/lib/services/landing/queries'
import { prisma } from '@/lib/db'

export async function GET() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await listLandingProjectsForPublisher(publisherId)
  return NextResponse.json(projects)
}

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()

  if (request.headers.get('content-type')?.includes('application/json')) {
    const json = await request.json().catch(() => null)
    if (!json || typeof json !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const title = typeof json.title === 'string' ? json.title.slice(0, 200) : 'Untitled Book'
    const subtitle = typeof json.subtitle === 'string' ? json.subtitle.slice(0, 300) : ''
    const author = typeof json.author === 'string' ? json.author.slice(0, 200) : ''
    const synopsis = typeof json.synopsis === 'string' ? json.synopsis.slice(0, 4000) : ''
    const authorBio = typeof json.authorBio === 'string' ? json.authorBio.slice(0, 2000) : ''

    const project = await prisma.landingProject.create({
      data: {
        publisherId,
        title,
        subtitle,
        author,
        synopsis,
        authorBio,
        template: 'bestseller',
        theme: 'matt',
        accentColor: '#6366f1',
        ctaText: 'Order Your Copy Today',
        status: 'uploaded',
      },
    })

    return NextResponse.json({ id: project.id }, { status: 201 })
  }

  // Handle multipart/form-data upload (PDF / Cover)
  const form = await request.formData()
  const pdfFile = form.get('pdf')

  if (pdfFile !== null && !(pdfFile instanceof File)) {
    return NextResponse.json({ error: 'pdf must be a file' }, { status: 400 })
  }
  if (!pdfFile) {
    return NextResponse.json({ error: 'pdf is required' }, { status: 400 })
  }
  if (pdfFile.size > PDF_RULE.maxBytes) {
    return NextResponse.json({ error: 'pdf exceeds the 25MB size limit' }, { status: 400 })
  }

  const pdfBytes = Buffer.from(await pdfFile.arrayBuffer())
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
    coverUrl = (await storeFile(`landing/${publisherId}/${Date.now()}-cover.png`, bytes, manualCover.type)).url
  } else if (extractedAssets.frontCoverPng) {
    coverUrl = (await storeFile(`landing/${publisherId}/${Date.now()}-cover.png`, extractedAssets.frontCoverPng, 'image/png')).url
  }

  // Extract a sample excerpt from beginning
  const sampleExcerpt = fullPdfText
    ? fullPdfText.slice(0, 1800).trim()
    : 'The journey began when the first lights flickered on the horizon. Every step forward carried the weight of an unresolved past.'

  const project = await prisma.landingProject.create({
    data: {
      publisherId,
      title: extractedAssets.title || 'Untitled Book',
      subtitle: 'An extraordinary novel of suspense and discovery',
      author: extractedAssets.author || '',
      synopsis: extractedAssets.blurb || '',
      coverUrl,
      sampleChapterTitle: 'Chapter 1: The Beginning',
      sampleChapterText: sampleExcerpt,
      template: 'bestseller',
      theme: 'matt',
      accentColor: '#6366f1',
      ctaText: 'Order Your Copy Today',
      status: 'uploaded',
    },
  })

  return NextResponse.json({ id: project.id }, { status: 201 })
}
