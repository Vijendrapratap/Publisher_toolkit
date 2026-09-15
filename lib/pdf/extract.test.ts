import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractBookAssets } from './extract'
import { buildFixturePdf } from './testFixtures'

describe('extractBookAssets', () => {
  it('extracts title/author text and renders front/back cover images', async () => {
    const pdf = await buildFixturePdf()
    const result = await extractBookAssets(pdf)

    expect(result.title).toContain('The Lazy Developer')
    expect(result.frontCoverPng).not.toBeNull()
    expect(result.backCoverPng).not.toBeNull()
    // PNG signature check — first 8 bytes identify a valid PNG.
    expect(result.frontCoverPng!.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  })

  it('returns nulls instead of throwing for an empty/invalid PDF', async () => {
    const result = await extractBookAssets(Buffer.from('not a pdf'))
    expect(result.title).toBeNull()
    expect(result.frontCoverPng).toBeNull()
  })

  afterEach(() => {
    vi.doUnmock('pdfjs-dist/legacy/build/pdf.mjs')
    vi.resetModules()
  })

  it('does not throw when a parsed PDF has a broken page-tree entry or malformed content stream', async () => {
    // Simulates a PDF that parses into a valid document (getDocument succeeds)
    // but has a broken page: getPage() rejects for the last page (corrupted
    // page-tree entry) and getTextContent() rejects for the first page
    // (malformed content stream).
    vi.resetModules()
    vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: (pageNum: number) => {
            if (pageNum === 1) {
              return Promise.resolve({
                getViewport: () => ({ width: 10, height: 10 }),
                render: () => ({ promise: Promise.resolve() }),
                getTextContent: () => Promise.reject(new Error('malformed content stream')),
              })
            }
            return Promise.reject(new Error('corrupted page-tree entry'))
          },
        }),
      }),
    }))

    const { extractBookAssets: extractWithBrokenPages } = await import('./extract')
    const result = await extractWithBrokenPages(Buffer.from('irrelevant, pdfjs-dist is mocked'))

    // First-page text extraction failed -> title/author fall back to null,
    // but the first-page render still succeeded independently.
    expect(result.title).toBeNull()
    expect(result.author).toBeNull()
    expect(result.frontCoverPng).not.toBeNull()

    // Last-page fetch failed entirely -> back cover and blurb fall back to
    // null, without throwing and without clobbering the first-page results.
    expect(result.backCoverPng).toBeNull()
    expect(result.blurb).toBeNull()
  })
})
