import { describe, it, expect } from 'vitest'
import { COVER_RULE, PDF_RULE, formatBytes, validateFile } from './validation'

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
