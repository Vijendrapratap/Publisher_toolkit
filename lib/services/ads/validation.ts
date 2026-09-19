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
