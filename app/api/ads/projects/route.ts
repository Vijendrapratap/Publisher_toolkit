import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { storeFile } from '@/lib/providers/storage'
import { extractBookAssets } from '@/lib/services/ads/extract'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => ({}))
    const {
      existingBookId,
      title,
      author,
      blurb,
      frontCoverUrl,
      campaignName,
      campaignObjective,
      templateKey,
      copyTone,
      targetAudience,
      customHook,
      ctaText,
      platforms,
    } = json

    if (existingBookId) {
      const sourceBook = await prisma.book.findFirst({
        where: { id: existingBookId, publisherId },
      })
      if (!sourceBook) {
        return NextResponse.json({ error: 'Selected book not found' }, { status: 404 })
      }

      const rootId = sourceBook.parentBookId ?? sourceBook.id
      const newProject = await prisma.book.create({
        data: {
          publisherId,
          title: sourceBook.title,
          author: sourceBook.author,
          blurb: sourceBook.blurb,
          pdfUrl: sourceBook.pdfUrl,
          frontCoverUrl: sourceBook.frontCoverUrl,
          backCoverUrl: sourceBook.backCoverUrl,
          status: 'configured',
          platforms: Array.isArray(platforms) && platforms.length > 0 ? platforms : sourceBook.platforms,
          parentBookId: rootId,
          campaignName: campaignName?.trim() || 'New Campaign',
          campaignObjective: campaignObjective || 'launch',
          templateKey: templateKey || sourceBook.templateKey || 'classic',
          copyTone: copyTone || sourceBook.copyTone || 'literary',
          targetAudience: targetAudience?.trim() || null,
          customHook: customHook?.trim() || null,
          ctaText: ctaText?.trim() || 'Order Your Copy Today',
        },
      })

      return NextResponse.json({ id: newProject.id, isExisting: true }, { status: 201 })
    }

    if (title || frontCoverUrl) {
      const newProject = await prisma.book.create({
        data: {
          publisherId,
          title: title?.trim()?.slice(0, 200) || 'Untitled Book',
          author: author?.trim()?.slice(0, 200) || '',
          blurb: blurb?.trim()?.slice(0, 2000) || '',
          pdfUrl: '',
          frontCoverUrl: frontCoverUrl || null,
          status: frontCoverUrl ? 'configured' : 'uploaded',
          platforms: Array.isArray(platforms) && platforms.length > 0 ? platforms : ['META', 'GOOGLE', 'AMAZON'],
          campaignName: campaignName?.trim() || 'New Campaign',
          campaignObjective: campaignObjective || 'launch',
          templateKey: templateKey || 'classic',
          copyTone: copyTone || 'literary',
          targetAudience: targetAudience?.trim() || null,
          customHook: customHook?.trim() || null,
          ctaText: ctaText?.trim() || 'Order Your Copy Today',
        },
      })

      return NextResponse.json({ id: newProject.id, isDirect: true }, { status: 201 })
    }

    return NextResponse.json({ error: 'Please provide a book PDF or enter book details.' }, { status: 400 })
  }

  const form = await request.formData()

  const existingBookId = form.get('existingBookId')
  if (existingBookId && typeof existingBookId === 'string') {
    const sourceBook = await prisma.book.findFirst({
      where: { id: existingBookId, publisherId },
    })
    if (!sourceBook) {
      return NextResponse.json({ error: 'Selected book not found' }, { status: 404 })
    }
    const rootId = sourceBook.parentBookId ?? sourceBook.id
    const campaignName = form.get('campaignName')
    const campaignObjective = form.get('campaignObjective')
    const templateKey = form.get('templateKey')
    const copyTone = form.get('copyTone')
    const targetAudience = form.get('targetAudience')
    const customHook = form.get('customHook')
    const ctaText = form.get('ctaText')

    const newProject = await prisma.book.create({
      data: {
        publisherId,
        title: sourceBook.title,
        author: sourceBook.author,
        blurb: sourceBook.blurb,
        pdfUrl: sourceBook.pdfUrl,
        frontCoverUrl: sourceBook.frontCoverUrl,
        backCoverUrl: sourceBook.backCoverUrl,
        status: 'configured',
        parentBookId: rootId,
        campaignName: typeof campaignName === 'string' && campaignName.trim() ? campaignName.trim() : 'New Campaign',
        campaignObjective: typeof campaignObjective === 'string' ? campaignObjective : 'launch',
        templateKey: typeof templateKey === 'string' ? templateKey : (sourceBook.templateKey || 'classic'),
        copyTone: typeof copyTone === 'string' ? copyTone : (sourceBook.copyTone || 'literary'),
        targetAudience: typeof targetAudience === 'string' && targetAudience.trim() ? targetAudience.trim() : null,
        customHook: typeof customHook === 'string' && customHook.trim() ? customHook.trim() : null,
        ctaText: typeof ctaText === 'string' && ctaText.trim() ? ctaText.trim() : 'Order Your Copy Today',
      },
    })
    return NextResponse.json({ id: newProject.id, isExisting: true }, { status: 201 })
  }

  const pdfFile = form.get('pdf')
  if (pdfFile !== null && !(pdfFile instanceof File)) {
    return NextResponse.json({ error: 'pdf must be a file' }, { status: 400 })
  }

  if (pdfFile instanceof File && pdfFile.size > 0) {
    if (pdfFile.size > PDF_RULE.maxBytes) {
      return NextResponse.json({ error: 'pdf exceeds the 25MB size limit' }, { status: 400 })
    }
    if (!PDF_RULE.accept.includes(pdfFile.type)) {
      return NextResponse.json({ error: 'pdf must be a PDF file' }, { status: 400 })
    }
    const pdfBytes = Buffer.from(await pdfFile.arrayBuffer())
    const { url: pdfUrl } = await storeFile(`ads/${publisherId}/${Date.now()}.pdf`, pdfBytes, 'application/pdf')

    const extracted = await extractBookAssets(pdfBytes)

    let manualFrontCover = form.get('frontCover') || form.get('manualFrontCover')
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

    const campaignName = form.get('campaignName')
    const campaignObjective = form.get('campaignObjective')
    const templateKey = form.get('templateKey')
    const copyTone = form.get('copyTone')
    const targetAudience = form.get('targetAudience')
    const customHook = form.get('customHook')
    const ctaText = form.get('ctaText')

    const book = await prisma.book.create({
      data: {
        publisherId,
        title: extracted.title,
        author: extracted.author,
        blurb: extracted.blurb,
        pdfUrl,
        frontCoverUrl,
        backCoverUrl,
        campaignName: typeof campaignName === 'string' && campaignName.trim() ? campaignName.trim() : 'Launch Campaign',
        campaignObjective: typeof campaignObjective === 'string' ? campaignObjective : 'launch',
        templateKey: typeof templateKey === 'string' ? templateKey : 'classic',
        copyTone: typeof copyTone === 'string' ? copyTone : 'literary',
        targetAudience: typeof targetAudience === 'string' && targetAudience.trim() ? targetAudience.trim() : null,
        customHook: typeof customHook === 'string' && customHook.trim() ? customHook.trim() : null,
        ctaText: typeof ctaText === 'string' && ctaText.trim() ? ctaText.trim() : 'Order Your Copy Today',
      },
    })

    return NextResponse.json(
      { id: book.id, needsManualCover: !frontCoverUrl },
      { status: 201 }
    )
  }

  // PDF is not provided or empty: allow manual project creation
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
    const mime = manualFrontCover.type === 'image/jpg' || !manualFrontCover.type ? 'image/jpeg' : manualFrontCover.type
    frontCoverUrl = (await storeFile(`ads/${publisherId}/${Date.now()}-front.png`, bytes, mime)).url
  }

  let backCoverUrl: string | null = null
  if (manualBackCover) {
    const bytes = Buffer.from(await manualBackCover.arrayBuffer())
    backCoverUrl = (await storeFile(`ads/${publisherId}/${Date.now()}-back.png`, bytes, manualBackCover.type)).url
  }

  const rawAuthor = form.get('author')
  const rawBlurb = form.get('blurb')
  const campaignName = form.get('campaignName')
  const campaignObjective = form.get('campaignObjective')
  const templateKey = form.get('templateKey')
  const copyTone = form.get('copyTone')
  const targetAudience = form.get('targetAudience')
  const customHook = form.get('customHook')
  const ctaText = form.get('ctaText')

  const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim().slice(0, 200) : 'Untitled Book'
  const author = typeof rawAuthor === 'string' && rawAuthor.trim() ? rawAuthor.trim().slice(0, 200) : ''
  const blurb = typeof rawBlurb === 'string' && rawBlurb.trim() ? rawBlurb.trim().slice(0, 2000) : ''

  const book = await prisma.book.create({
    data: {
      publisherId,
      title,
      author,
      blurb,
      pdfUrl: '',
      frontCoverUrl,
      backCoverUrl,
      status: frontCoverUrl ? 'configured' : 'uploaded',
      campaignName: typeof campaignName === 'string' && campaignName.trim() ? campaignName.trim() : 'Launch Campaign',
      campaignObjective: typeof campaignObjective === 'string' ? campaignObjective : 'launch',
      templateKey: typeof templateKey === 'string' ? templateKey : 'classic',
      copyTone: typeof copyTone === 'string' ? copyTone : 'literary',
      targetAudience: typeof targetAudience === 'string' && targetAudience.trim() ? targetAudience.trim() : null,
      customHook: typeof customHook === 'string' && customHook.trim() ? customHook.trim() : null,
      ctaText: typeof ctaText === 'string' && ctaText.trim() ? ctaText.trim() : 'Order Your Copy Today',
    },
  })

  return NextResponse.json(
    { id: book.id, needsManualCover: !frontCoverUrl, isDirect: true },
    { status: 201 }
  )
}
