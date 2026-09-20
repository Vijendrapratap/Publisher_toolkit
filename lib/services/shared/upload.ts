export interface FileRule {
  accept: string[]
  maxBytes: number
  label: string
}

export const PDF_RULE: FileRule = { accept: ['application/pdf'], maxBytes: 25 * 1024 * 1024, label: 'a PDF up to 25 MB' }

export const COVER_RULE: FileRule = {
  accept: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  maxBytes: 10 * 1024 * 1024,
  label: 'a PNG, JPG or WebP up to 10 MB',
}

export function validateFile(file: { type: string; size: number; name?: string }, rule: FileRule): string | null {
  if (file.size === 0) return 'This file is empty.'
  const isImageRule = rule.accept.some((t) => t.startsWith('image/'))
  const ext = file.name ? file.name.split('.').pop()?.toLowerCase() : ''
  const isImageExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '')
  const isPdfExt = ext === 'pdf'

  const matchesType = rule.accept.includes(file.type) || (file.type === 'image/jpg' && rule.accept.includes('image/jpeg'))
  const matchesExt = isImageRule ? isImageExt : isPdfExt

  if (!matchesType && !matchesExt) {
    return `This file type isn't supported. Use ${rule.label}.`
  }
  if (file.size > rule.maxBytes) return `This file is too large. Use ${rule.label}.`
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KB`
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'application/zip': 'zip',
}

/** Browsers send several spellings for the same image format. */
export function normalizeImageType(type: string | undefined, name?: string): string {
  const normalized = (type || '').toLowerCase()
  if (normalized === 'image/jpg' || normalized === 'image/pjpeg') return 'image/jpeg'
  if (EXTENSIONS[normalized]) return normalized
  const ext = name?.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return normalized || 'application/octet-stream'
}

export function isAllowedCoverType(type: string | undefined, name?: string): boolean {
  return COVER_RULE.accept.includes(normalizeImageType(type, name))
}

/**
 * Storage keys used to be `${Date.now()}-front.png`: two covers saved in the
 * same millisecond overwrote each other, and every file was named `.png`
 * whatever it actually was, so local mode served JPEGs as image/png.
 */
export function assetPath(
  prefix: string,
  publisherId: string,
  name: string,
  contentType: string
): string {
  const ext = EXTENSIONS[contentType.toLowerCase()] ?? 'bin'
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}/${publisherId}/${unique}-${name}.${ext}`
}

/** Validates and stores one uploaded image, or returns null when none was sent. */
export async function storeUploadedImage(
  file: unknown,
  prefix: string,
  publisherId: string,
  name: string,
  store: (pathname: string, data: Buffer, contentType: string) => Promise<{ url: string }>
): Promise<string | null> {
  // An unselected <input type="file"> still submits as a zero-byte File.
  if (!(file instanceof File) || file.size === 0) return null
  const contentType = normalizeImageType(file.type, file.name)
  const { url } = await store(
    assetPath(prefix, publisherId, name, contentType),
    Buffer.from(await file.arrayBuffer()),
    contentType
  )
  return url
}
