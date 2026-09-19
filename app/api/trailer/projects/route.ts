import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { storeFile } from '@/lib/providers/storage'
import { extractBookAssets } from '@/lib/services/ads/extract'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  const contentType = request.headers.get('content-type') || ''

  // 1. JSON Request Handler (Existing book from library or direct metadata)
  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => ({}))
    const {
      existingBookId,
      title,
      author,
      blurb,
      frontCoverUrl,
      backCoverUrl,
      style,
      length,
      musicMood,
      aspectRatios,
      hookText,
      ctaText,
    } = json

    if (existingBookId) {
      // Look up in Books or TrailerProjects
      const sourceBook = await prisma.book.findFirst({
        where: { id: existingBookId, publisherId },
      })
      const sourceTrailer = !sourceBook
        ? await prisma.trailerProject.findFirst({
            where: { id: existingBookId, publisherId },
          })
        : null

      const source = sourceBook || sourceTrailer
      if (!source) {
        return NextResponse.json({ error: 'Selected book not found' }, { status: 404 })
      }

      const hasCover = Boolean(source.frontCoverUrl)
      const newProject = await prisma.trailerProject.create({
        data: {
          publisherId,
          title: source.title,
          author: source.author,
          blurb: source.blurb,
          pdfUrl: source.pdfUrl,
          frontCoverUrl: source.frontCoverUrl,
          backCoverUrl: source.backCoverUrl,
          status: hasCover ? 'configured' : 'uploaded',
          style: style || ('style' in source && source.style ? source.style : 'cinematic'),
          length: length || ('length' in source && source.length ? source.length : '30s'),
          musicMood: musicMood || ('musicMood' in source && source.musicMood ? source.musicMood : 'suspenseful'),
          aspectRatios: Array.isArray(aspectRatios) && aspectRatios.length > 0
            ? aspectRatios
            : ('aspectRatios' in source && Array.isArray(source.aspectRatios) && source.aspectRatios.length > 0
              ? source.aspectRatios
              : ['9:16', '1:1', '16:9']),
          hookText: hookText?.trim() || ('hookText' in source ? source.hookText : null),
          ctaText: ctaText?.trim() || ('ctaText' in source && source.ctaText ? source.ctaText : 'AVAILABLE NOW • GET YOUR COPY TODAY'),
        },
      })

      return NextResponse.json(
        { id: newProject.id, isExisting: true, needsManualCover: !hasCover },
        { status: 201 }
      )
    }

    if (title || frontCoverUrl) {
      const hasCover = Boolean(frontCoverUrl)
      const newProject = await prisma.trailerProject.create({
        data: {
          publisherId,
          title: title?.trim()?.slice(0, 200) || 'Untitled Book',
          author: author?.trim()?.slice(0, 200) || '',
          blurb: blurb?.trim()?.slice(0, 2000) || '',
          pdfUrl: '',
          frontCoverUrl: frontCoverUrl || null,
          backCoverUrl: backCoverUrl || null,
          status: hasCover ? 'configured' : 'uploaded',
          style: style || 'cinematic',
          length: length || '30s',
          musicMood: musicMood || 'suspenseful',
          aspectRatios: Array.isArray(aspectRatios) && aspectRatios.length > 0 ? aspectRatios : ['9:16', '1:1', '16:9'],
          hookText: hookText?.trim() || null,
          ctaText: ctaText?.trim() || 'AVAILABLE NOW • GET YOUR COPY TODAY',
        },
      })

      return NextResponse.json(
        { id: newProject.id, isDirect: true, needsManualCover: !hasCover },
        { status: 201 }
      )
    }

    return NextResponse.json({ error: 'Please provide a book PDF or enter book details.' }, { status: 400 })
  }

  // 2. FormData Request Handler (PDF Upload or Quick Setup with File Attachments)
  const form = await request.formData()

  const existingBookId = form.get('existingBookId')
  if (existingBookId && typeof existingBookId === 'string') {
    const sourceBook = await prisma.book.findFirst({
      where: { id: existingBookId, publisherId },
    })
    const sourceTrailer = !sourceBook
      ? await prisma.trailerProject.findFirst({
          where: { id: existingBookId, publisherId },
        })
      : null

    const source = sourceBook || sourceTrailer
    if (!source) {
      return NextResponse.json({ error: 'Selected book not found' }, { status: 404 })
    }

    const style = form.get('style')
    const length = form.get('length')
    const musicMood = form.get('musicMood')
    const hookText = form.get('hookText')
    const ctaText = form.get('ctaText')

    const hasCover = Boolean(source.frontCoverUrl)
    const newProject = await prisma.trailerProject.create({
      data: {
        publisherId,
        title: source.title,
        author: source.author,
        blurb: source.blurb,
        pdfUrl: source.pdfUrl,
        frontCoverUrl: source.frontCoverUrl,
        backCoverUrl: source.backCoverUrl,
        status: hasCover ? 'configured' : 'uploaded',
        style: typeof style === 'string' ? style : ('style' in source && source.style ? source.style : 'cinematic'),
        length: typeof length === 'string' ? length : ('length' in source && source.length ? source.length : '30s'),
        musicMood: typeof musicMood === 'string' ? musicMood : ('musicMood' in source && source.musicMood ? source.musicMood : 'suspenseful'),
        aspectRatios: 'aspectRatios' in source && Array.isArray(source.aspectRatios) && source.aspectRatios.length > 0
          ? source.aspectRatios
          : ['9:16', '1:1', '16:9'],
        hookText: typeof hookText === 'string' && hookText.trim() ? hookText.trim() : ('hookText' in source ? source.hookText : null),
        ctaText: typeof ctaText === 'string' && ctaText.trim() ? ctaText.trim() : ('ctaText' in source && source.ctaText ? source.ctaText : 'AVAILABLE NOW • GET YOUR COPY TODAY'),
      },
    })
    return NextResponse.json(
      { id: newProject.id, isExisting: true, needsManualCover: !hasCover },
      { status: 201 }
    )
  }

  const pdfFile = form.get('pdf')
  if (pdfFile !== null && !(pdfFile instanceof File)) {
    return NextResponse.json({ error: 'pdf must be a file' }, { status: 400 })
  }

  // 2A. Full PDF Upload Flow
  if (pdfFile instanceof File && pdfFile.size > 0) {
    if (pdfFile.size > PDF_RULE.maxBytes) {
      return NextResponse.json({ error: 'pdf exceeds the 25MB size limit' }, { status: 400 })
    }
    if (!PDF_RULE.accept.includes(pdfFile.type)) {
      return NextResponse.json({ error: 'pdf must be a PDF file' }, { status: 400 })
    }
    const pdfBytes = Buffer.from(await pdfFile.arrayBuffer())
    const { url: pdfUrl } = await storeFile(`trailer/${publisherId}/${Date.now()}.pdf`, pdfBytes, 'application/pdf')

    const extracted = await extractBookAssets(pdfBytes)

    let manualFrontCover = form.get('frontCover') || form.get('manualFrontCover')
    let manualBackCover = form.get('backCover')
    if (manualFrontCover !== null && !(manualFrontCover instanceof File)) {
      return NextResponse.json({ error: 'frontCover must be a file' }, { status: 400 })
    }
    if (manualBackCover !== null && !(manualBackCover instanceof File)) {
      return NextResponse.json({ error: 'backCover must be a file' }, { status: 400 })
    }
    if (manualFrontCover instanceof File && manualFrontCover.size === 0) manualFrontCover = null
    if (manualBackCover instanceof File && manualBackCover.size === 0) manualBackCover = null

    const isAllowedCoverType = (type: string, name?: string) => {
      const normalized = (type || '').toLowerCase()
      if (['image/png', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/webp'].includes(normalized)) return true
      if (name && /\.(png|jpe?g|webp)$/i.test(name)) return true
      return false
    }

    for (const cover of [manualFrontCover, manualBackCover]) {
      if (!cover) continue
      if (cover.size > COVER_RULE.maxBytes) {
        return NextResponse.json({ error: 'cover image exceeds the 10MB size limit' }, { status: 400 })
      }
      if (!isAllowedCoverType(cover.type, cover.name)) {
        return NextResponse.json({ error: 'cover image must be png, jpeg, or webp' }, { status: 400 })
      }
    }

    let frontCoverUrl: string | null = null
    if (manualFrontCover) {
      const bytes = Buffer.from(await manualFrontCover.arrayBuffer())
      frontCoverUrl = (await storeFile(`trailer/${publisherId}/${Date.now()}-front.png`, bytes, manualFrontCover.type)).url
    } else if (extracted.frontCoverPng) {
      frontCoverUrl = (await storeFile(`trailer/${publisherId}/${Date.now()}-front.png`, extracted.frontCoverPng, 'image/png')).url
    }

    let backCoverUrl: string | null = null
    if (manualBackCover) {
      const bytes = Buffer.from(await manualBackCover.arrayBuffer())
      backCoverUrl = (await storeFile(`trailer/${publisherId}/${Date.now()}-back.png`, bytes, manualBackCover.type)).url
    } else if (extracted.backCoverPng) {
      backCoverUrl = (await storeFile(`trailer/${publisherId}/${Date.now()}-back.png`, extracted.backCoverPng, 'image/png')).url
    }

    const style = form.get('style')
    const length = form.get('length')
    const musicMood = form.get('musicMood')
    const hookText = form.get('hookText')
    const ctaText = form.get('ctaText')

    const project = await prisma.trailerProject.create({
      data: {
        publisherId,
        title: extracted.title,
        author: extracted.author,
        blurb: extracted.blurb,
        pdfUrl,
        frontCoverUrl,
        backCoverUrl,
        status: 'uploaded',
        style: typeof style === 'string' ? style : 'cinematic',
        length: typeof length === 'string' ? length : '30s',
        musicMood: typeof musicMood === 'string' ? musicMood : 'suspenseful',
        hookText: typeof hookText === 'string' && hookText.trim() ? hookText.trim() : null,
        ctaText: typeof ctaText === 'string' && ctaText.trim() ? ctaText.trim() : 'AVAILABLE NOW • GET YOUR COPY TODAY',
      },
    })

    return NextResponse.json(
      { id: project.id, needsManualCover: !frontCoverUrl },
      { status: 201 }
    )
  }

  // 2B. Quick Setup via FormData (PDF omitted / manual entry)
  const rawTitle = form.get('title')
  let manualFrontCover = form.get('frontCover') || form.get('manualFrontCover')
  let manualBackCover = form.get('backCover')

  if (manualFrontCover !== null && !(manualFrontCover instanceof File)) {
    return NextResponse.json({ error: 'frontCover must be a file' }, { status: 400 })
  }
  if (manualBackCover !== null && !(manualBackCover instanceof File)) {
    return NextResponse.json({ error: 'backCover must be a file' }, { status: 400 })
  }
  if (manualFrontCover instanceof File && manualFrontCover.size === 0) manualFrontCover = null
  if (manualBackCover instanceof File && manualBackCover.size === 0) manualBackCover = null

  const hasTitle = typeof rawTitle === 'string' && rawTitle.trim().length > 0
  const hasCover = Boolean(manualFrontCover)

  if (!hasTitle && !hasCover) {
    return NextResponse.json({ error: 'Please provide a book PDF or enter book details.' }, { status: 400 })
  }

  const isAllowedCoverType = (type: string, name?: string) => {
    const normalized = (type || '').toLowerCase()
    if (['image/png', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/webp'].includes(normalized)) return true
    if (name && /\.(png|jpe?g|webp)$/i.test(name)) return true
    return false
  }

  for (const cover of [manualFrontCover, manualBackCover]) {
    if (!cover) continue
    if (cover.size > COVER_RULE.maxBytes) {
      return NextResponse.json({ error: 'cover image exceeds the 10MB size limit' }, { status: 400 })
    }
    if (!isAllowedCoverType(cover.type, cover.name)) {
      return NextResponse.json({ error: 'cover image must be png, jpeg, or webp' }, { status: 400 })
    }
  }

  let frontCoverUrl: string | null = null
  if (manualFrontCover) {
    const bytes = Buffer.from(await manualFrontCover.arrayBuffer())
    frontCoverUrl = (await storeFile(`trailer/${publisherId}/${Date.now()}-front.png`, bytes, manualFrontCover.type)).url
  }

  let backCoverUrl: string | null = null
  if (manualBackCover) {
    const bytes = Buffer.from(await manualBackCover.arrayBuffer())
    backCoverUrl = (await storeFile(`trailer/${publisherId}/${Date.now()}-back.png`, bytes, manualBackCover.type)).url
  }

  const rawAuthor = form.get('author')
  const rawBlurb = form.get('blurb')
  const style = form.get('style')
  const length = form.get('length')
  const musicMood = form.get('musicMood')
  const hookText = form.get('hookText')
  const ctaText = form.get('ctaText')

  const titleToStore = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim().slice(0, 200) : 'Untitled Book'
  const authorToStore = typeof rawAuthor === 'string' ? rawAuthor.trim().slice(0, 200) : ''
  const blurbToStore = typeof rawBlurb === 'string' ? rawBlurb.trim().slice(0, 2000) : ''

  const project = await prisma.trailerProject.create({
    data: {
      publisherId,
      title: titleToStore,
      author: authorToStore,
      blurb: blurbToStore,
      pdfUrl: '',
      frontCoverUrl,
      backCoverUrl,
      status: frontCoverUrl ? 'configured' : 'uploaded',
      style: typeof style === 'string' ? style : 'cinematic',
      length: typeof length === 'string' ? length : '30s',
      musicMood: typeof musicMood === 'string' ? musicMood : 'suspenseful',
      hookText: typeof hookText === 'string' && hookText.trim() ? hookText.trim() : null,
      ctaText: typeof ctaText === 'string' && ctaText.trim() ? ctaText.trim() : 'AVAILABLE NOW • GET YOUR COPY TODAY',
    },
  })

  return NextResponse.json(
    { id: project.id, isDirect: true, needsManualCover: !frontCoverUrl },
    { status: 201 }
  )
}
