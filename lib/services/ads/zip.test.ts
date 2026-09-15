import { describe, it, expect, vi } from 'vitest'
import JSZip from 'jszip'
import { buildCreativeZip, zipFileName } from './zip'

describe('buildCreativeZip', () => {
  it('puts images in per-platform folders and copy in copy.txt', async () => {
    const read = vi.fn(async (url: string) => ({ data: Buffer.from(`bytes:${url}`), contentType: 'image/png' }))
    const buffer = await buildCreativeZip(
      {
        title: 'The Lazy Developer',
        images: [
          { platform: 'META', sizeKey: 'meta_feed_1080x1080', imageUrl: '/a.png' },
          { platform: 'GOOGLE', sizeKey: 'google_display_728x90', imageUrl: '/b.png' },
        ],
        copies: [{ platform: 'META', headline: 'Hook', primaryText: 'Text', description: 'Desc' }],
      },
      read
    )

    const zip = await JSZip.loadAsync(buffer)
    expect(Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort()).toEqual([
      'copy.txt',
      'google/google_display_728x90.png',
      'meta/meta_feed_1080x1080.png',
    ])
    expect(await zip.file('meta/meta_feed_1080x1080.png')!.async('string')).toBe('bytes:/a.png')
    const copy = await zip.file('copy.txt')!.async('string')
    expect(copy).toContain('The Lazy Developer')
    expect(copy).toContain('META')
    expect(copy).toContain('Headline: Hook')
  })
})

describe('zipFileName', () => {
  it('slugifies the title', () => {
    expect(zipFileName('The Lazy Developer!')).toBe('the-lazy-developer-ad-creatives.zip')
    expect(zipFileName('')).toBe('book-ad-creatives.zip')
  })
})
