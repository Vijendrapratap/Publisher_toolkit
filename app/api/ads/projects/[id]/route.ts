import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { storeFile } from '@/lib/providers/storage'
import { projectUpdateSchema } from '@/lib/services/ads/options'
import { isAllowedCoverType, storeUploadedImage, COVER_RULE } from '@/lib/services/shared/upload'
import { adVideoSpecSchema, clip, ownsMusicUpload, presetStyle, SCRIPT_LIMITS, type AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { prisma } from '@/lib/db'
import type { Book } from '@prisma/client'
import type { z } from 'zod'

/** Fields the Configure page saves that also feed the video script/style. */
const VIDEO_FIELD_KEYS = ['videoFormat', 'videoLength', 'videoMood', 'videoStyle', 'customHook', 'ctaText'] as const
type VideoFieldKey = (typeof VIDEO_FIELD_KEYS)[number]

/**
 * The Configure page's plain book columns (format/length/mood/style/hook/
 * cta) are the source of truth for those fields, but the AI Video and
 * Instant Video editors render from `videoSpec` alone, and can leave it
 * diverged from those columns on purpose (a custom font/colour, a hook
 * tweaked in place). Without comparing against the book's own columns,
 * ANY Configure save (even one that only changes platforms) re-applies
 * every video field unconditionally and clobbers that divergence. Only a
 * field that actually changed on the Configure page should be re-applied.
 */
function deriveVideoSpecUpdate(update: z.infer<typeof projectUpdateSchema>, currentSpec: AdVideoSpec, book: Book): AdVideoSpec | null {
  const changed = (key: VideoFieldKey): boolean => {
    const value = update[key]
    if (value === undefined) return false
    if ((key === 'customHook' || key === 'ctaText') && !value.trim()) return false
    return value !== book[key]
  }
  if (!VIDEO_FIELD_KEYS.some(changed)) return null

  const spec: AdVideoSpec = {
    ...currentSpec,
    ...(changed('videoFormat') ? { format: update.videoFormat! } : {}),
    ...(changed('videoLength') ? { length: update.videoLength! } : {}),
    ...(changed('videoMood') ? { mood: update.videoMood! } : {}),
    ...(changed('videoStyle') ? { style: presetStyle(update.videoStyle!) } : {}),
    script: {
      ...currentSpec.script,
      ...(changed('customHook') ? { hook: clip(update.customHook!, SCRIPT_LIMITS.hook) } : {}),
      ...(changed('ctaText') ? { cta: clip(update.ctaText!, SCRIPT_LIMITS.cta) } : {}),
    },
  }
  const parsed = adVideoSpecSchema.safeParse(spec)
  return parsed.success ? parsed.data : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (request.headers.get('content-type')?.includes('application/json')) {
    const raw = await request.json().catch(() => null)
    const parsed = projectUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update' }, { status: 400 })
    }
    const update = parsed.data
    if (update.videoSpec?.music && !ownsMusicUpload(update.videoSpec.music, publisherId)) {
      return NextResponse.json({ error: "That music file doesn't belong to this account." }, { status: 400 })
    }

    let data: typeof update = update
    if (!update.videoSpec) {
      const currentSpec = adVideoSpecSchema.safeParse(book.videoSpec)
      if (currentSpec.success) {
        const derived = deriveVideoSpecUpdate(update, currentSpec.data, book)
        if (derived) data = { ...update, videoSpec: derived }
      }
    }

    const completesConfig = Boolean(update.platforms && update.copyTone && update.templateKey)
    const updated = await prisma.book.update({
      where: { id: book.id },
      data: completesConfig ? { ...data, status: 'configured' } : data,
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
  // An unselected <input type="file"> still submits as a zero-byte File — treat it as absent.
  if (frontCover instanceof File && frontCover.size === 0) frontCover = null
  if (backCover instanceof File && backCover.size === 0) backCover = null
  for (const cover of [frontCover, backCover]) {
    if (!cover) continue
    if (cover.size > COVER_RULE.maxBytes) {
      return NextResponse.json({ error: 'cover image exceeds the 10MB size limit' }, { status: 400 })
    }
    if (!isAllowedCoverType(cover.type, cover.name)) {
      return NextResponse.json({ error: 'cover image must be png, jpeg, or webp' }, { status: 400 })
    }
  }
  if (!frontCover && !backCover) {
    return NextResponse.json({ error: 'frontCover or backCover is required' }, { status: 400 })
  }

  const [frontCoverUrl, backCoverUrl] = await Promise.all([
    storeUploadedImage(frontCover, 'ads', publisherId, 'front', storeFile),
    storeUploadedImage(backCover, 'ads', publisherId, 'back', storeFile),
  ])
  const data = {
    ...(frontCoverUrl ? { frontCoverUrl } : {}),
    ...(backCoverUrl ? { backCoverUrl } : {}),
  }

  const updated = await prisma.book.update({ where: { id: book.id }, data })

  return NextResponse.json({ id: updated.id }, { status: 200 })
}
