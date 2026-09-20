import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { storeFile } from '@/lib/providers/storage'
import { extractBookAssets } from '@/lib/services/ads/extract'
import {
  assetPath,
  isAllowedCoverType,
  normalizeImageType,
  COVER_RULE,
  PDF_RULE,
} from '@/lib/services/shared/upload'
import { inferPreset } from '@/lib/services/videoad/presets'
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
      sourceUrl,
      interiorImageUrls = [],
      style,
      length,
      musicMood,
      aspectRatios,
      hookText,
      ctaText,
      // Listing facts carried over from a URL import. They drive the ad preset,
      // the benefit lines the model writes, and the social-proof beat.
      rating,
      reviewCount,
      price,
      categories,
      bullets,
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
          sourceUrl: 'sourceUrl' in source ? (source.sourceUrl as string | null) : null,
          interiorImageUrls: Array.isArray(interiorImageUrls) && interiorImageUrls.length > 0
            ? interiorImageUrls
            : ('interiorImageUrls' in source && Array.isArray(source.interiorImageUrls) ? (source.interiorImageUrls as string[]) : []),
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

    if (title || frontCoverUrl || sourceUrl) {
      const hasCover = Boolean(frontCoverUrl)
      const newProject = await prisma.trailerProject.create({
        data: {
          publisherId,
          title: title?.trim()?.slice(0, 200) || 'Untitled Book',
          author: author?.trim()?.slice(0, 200) || '',
          blurb: blurb?.trim()?.slice(0, 2000) || '',
          pdfUrl: null,
          frontCoverUrl: frontCoverUrl || null,
          backCoverUrl: backCoverUrl || null,
          sourceUrl: sourceUrl || null,
          interiorImageUrls: Array.isArray(interiorImageUrls) ? interiorImageUrls : [],
          status: hasCover ? 'configured' : 'uploaded',
          style: style || 'cinematic',
          length: length || '15s',
          musicMood: musicMood || 'suspenseful',
          aspectRatios: Array.isArray(aspectRatios) && aspectRatios.length > 0 ? aspectRatios : ['9:16', '1:1', '16:9'],
          hookText: hookText?.trim() || null,
          ctaText: ctaText?.trim() || null,
          rating: typeof rating === 'number' ? rating : null,
          reviewCount: typeof reviewCount === 'number' ? reviewCount : null,
          price: typeof price === 'string' ? price : null,
          categories: Array.isArray(categories) ? categories.slice(0, 5) : [],
          bullets: Array.isArray(bullets) ? bullets.slice(0, 8) : [],
          adPreset: inferPreset({ categories, title }).key,
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
    const { url: pdfUrl } = await storeFile(assetPath('trailer', publisherId, 'manuscript', 'application/pdf'), pdfBytes, 'application/pdf')

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
      const coverType = normalizeImageType(manualFrontCover.type, manualFrontCover.name)
      frontCoverUrl = (await storeFile(assetPath('trailer', publisherId, 'front', coverType), bytes, coverType)).url
    } else if (extracted.frontCoverPng) {
      frontCoverUrl = (await storeFile(assetPath('trailer', publisherId, 'front', 'image/png'), extracted.frontCoverPng, 'image/png')).url
    }

    let backCoverUrl: string | null = null
    if (manualBackCover) {
      const bytes = Buffer.from(await manualBackCover.arrayBuffer())
      const coverType = normalizeImageType(manualBackCover.type, manualBackCover.name)
      backCoverUrl = (await storeFile(assetPath('trailer', publisherId, 'back', coverType), bytes, coverType)).url
    } else if (extracted.backCoverPng) {
      backCoverUrl = (await storeFile(assetPath('trailer', publisherId, 'back', 'image/png'), extracted.backCoverPng, 'image/png')).url
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
    const coverType = normalizeImageType(manualFrontCover.type, manualFrontCover.name)
    frontCoverUrl = (await storeFile(assetPath('trailer', publisherId, 'front', coverType), bytes, coverType)).url
  }

  let backCoverUrl: string | null = null
  if (manualBackCover) {
    const bytes = Buffer.from(await manualBackCover.arrayBuffer())
    const coverType = normalizeImageType(manualBackCover.type, manualBackCover.name)
    backCoverUrl = (await storeFile(assetPath('trailer', publisherId, 'back', coverType), bytes, coverType)).url
  }

  // Process 2-5 interior page images / illustrations if uploaded
  const rawInteriorFiles = form.getAll('interiorImages')
  const interiorImageUrls: string[] = []
  for (const item of rawInteriorFiles) {
    if (item instanceof File && item.size > 0) {
      if (item.size <= COVER_RULE.maxBytes && isAllowedCoverType(item.type, item.name)) {
        const bytes = Buffer.from(await item.arrayBuffer())
        const mime = normalizeImageType(item.type, item.name)
        const stored = await storeFile(assetPath('trailer/interior', publisherId, 'page', mime), bytes, mime)
        interiorImageUrls.push(stored.url)
      }
    }
  }

  const rawAuthor = form.get('author')
  const rawBlurb = form.get('blurb')
  const rawSourceUrl = form.get('sourceUrl')
  const style = form.get('style')
  const length = form.get('length')
  const musicMood = form.get('musicMood')
  const hookText = form.get('hookText')
  const ctaText = form.get('ctaText')

  const titleToStore = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim().slice(0, 200) : 'Untitled Book'
  const authorToStore = typeof rawAuthor === 'string' ? rawAuthor.trim().slice(0, 200) : ''
  const blurbToStore = typeof rawBlurb === 'string' ? rawBlurb.trim().slice(0, 2000) : ''
  const sourceUrlToStore = typeof rawSourceUrl === 'string' && rawSourceUrl.trim() ? rawSourceUrl.trim() : null

  const project = await prisma.trailerProject.create({
    data: {
      publisherId,
      title: titleToStore,
      author: authorToStore,
      blurb: blurbToStore,
      pdfUrl: null,
      frontCoverUrl,
      backCoverUrl,
      sourceUrl: sourceUrlToStore,
      interiorImageUrls,
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
