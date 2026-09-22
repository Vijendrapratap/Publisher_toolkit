import { describe, it, expect } from 'vitest'
import { COVER_RULE, PDF_RULE, formatBytes, validateFile, assetPath, normalizeImageType } from './upload'

describe('validateFile', () => {
  it('accepts a PDF within the limit', () => {
    expect(validateFile({ type: 'application/pdf', size: 1024 }, PDF_RULE)).toBeNull()
  })

  it('explains wrong types, oversized and empty files', () => {
    expect(validateFile({ type: 'image/png', size: 10 }, PDF_RULE)).toBe("This file type isn't supported. Use a PDF up to 25 MB.")
    expect(validateFile({ type: 'application/pdf', size: 25 * 1024 * 1024 + 1 }, PDF_RULE)).toBe('This file is too large. Use a PDF up to 25 MB.')
    expect(validateFile({ type: 'image/png', size: 0 }, COVER_RULE)).toBe('This file is empty.')
    expect(validateFile({ type: 'image/svg+xml', size: 10 }, COVER_RULE)).toBe("This file type isn't supported. Use a PNG, JPG or WebP up to 10 MB.")
  })
})

describe('formatBytes', () => {
  it('formats human sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('normalizeImageType', () => {
  it('collapses the browser spellings of JPEG', () => {
    expect(normalizeImageType('image/jpg')).toBe('image/jpeg')
    expect(normalizeImageType('image/pjpeg')).toBe('image/jpeg')
    expect(normalizeImageType('IMAGE/JPEG')).toBe('image/jpeg')
  })

  it('falls back to the filename when the browser sends no type', () => {
    expect(normalizeImageType('', 'cover.WEBP')).toBe('image/webp')
    expect(normalizeImageType(undefined, 'cover.jpeg')).toBe('image/jpeg')
  })

  it('leaves an unrecognisable upload alone rather than guessing', () => {
    expect(normalizeImageType('application/x-thing', 'cover.xyz')).toBe('application/x-thing')
  })
})

describe('assetPath', () => {
  it('derives the extension from the content type, not the caller', () => {
    expect(assetPath('ads', 'pub_1', 'front', 'image/jpeg')).toMatch(/^ads\/pub_1\/.+-front\.jpg$/)
    expect(assetPath('ads', 'pub_1', 'front', 'image/webp')).toMatch(/-front\.webp$/)
    expect(assetPath('ads', 'pub_1', 'manuscript', 'application/pdf')).toMatch(/-manuscript\.pdf$/)
  })

  it('never collides, even within the same millisecond', () => {
    const paths = new Set(
      Array.from({ length: 500 }, () => assetPath('ads', 'pub_1', 'front', 'image/png'))
    )
    expect(paths.size).toBe(500)
  })

  it('keeps every asset under its publisher prefix', () => {
    expect(assetPath('ads', 'pub_1', 'front', 'image/png').split('/')[1]).toBe('pub_1')
  })

  it('keeps the publisher second for nested prefixes, which the file route checks', () => {
    const path = assetPath('creator/proj_9', 'pub_1', 'cover', 'image/png')
    expect(path).toMatch(/^creator\/pub_1\/proj_9\/.+-cover\.png$/)
  })
})
