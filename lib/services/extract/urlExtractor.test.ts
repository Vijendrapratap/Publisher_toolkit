import { describe, it, expect, vi } from 'vitest'
import { lookup } from 'node:dns/promises'
import { parseBookHtml, extractBookFromUrl } from './urlExtractor'

vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: '/api/files/ads/pub_1/cover.jpg' }),
}))

// The SSRF guard resolves every host before fetching it; these tests must not
// depend on real DNS.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
}))

describe('parseBookHtml', () => {
  it('extracts Amazon book details accurately from HTML', () => {
    const amazonHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Amazon.com: The Way of Shadows: Brent Weeks: Books</title>
          <meta property="og:title" content="The Way of Shadows" />
          <meta property="og:description" content="A thrilling dark fantasy about an assassin apprentice." />
          <meta property="og:image" content="https://m.media-amazon.com/images/I/81XYZ.jpg" />
        </head>
        <body>
          <span id="productTitle">The Way of Shadows: The Night Angel Trilogy</span>
          <div id="bylineInfo">
            <span class="author notFaded"><a href="#">Brent Weeks</a></span>
          </div>
          <div id="bookDescription_feature_div">
            <p>From New York Times bestselling author Brent Weeks...</p>
          </div>
          <span id="acrPopover" title="4.7 out of 5 stars"></span>
          <span id="acrCustomerReviewText">4,520 ratings</span>
        </body>
      </html>
    `

    const parsed = parseBookHtml(amazonHtml, 'https://www.amazon.com/dp/B001...')
    expect(parsed.title).toContain('The Way of Shadows')
    expect(parsed.author).toBe('Brent Weeks')
    expect(parsed.blurb).toContain('From New York Times bestselling author')
    expect(parsed.rawCoverImageUrl).toBe('https://m.media-amazon.com/images/I/81XYZ.jpg')
    expect(parsed.rating).toBe(4.7)
    expect(parsed.reviewCount).toBe(4520)
  })

  it('falls back to OpenGraph meta tags when specific elements are absent', () => {
    const genericHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Starfall Horizon" />
          <meta name="author" content="Elena Rostova" />
          <meta property="og:description" content="In a galaxy torn by war, one pilot carries the code." />
          <meta property="og:image" content="https://example.com/cover.png" />
        </head>
        <body></body>
      </html>
    `

    const parsed = parseBookHtml(genericHtml, 'https://example.com/books/starfall')
    expect(parsed.title).toBe('Starfall Horizon')
    expect(parsed.author).toBe('Elena Rostova')
    expect(parsed.blurb).toBe('In a galaxy torn by war, one pilot carries the code.')
    expect(parsed.rawCoverImageUrl).toBe('https://example.com/cover.png')
  })
})

describe('extractBookFromUrl', () => {
  it('fetches and downloads the cover image into storage', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('image.jpg')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'image/jpeg' },
        })
      }
      return new Response(`
          <html>
            <span id="productTitle">Shadows of the Forgotten</span>
            <span class="author notFaded"><a href="#">K. L. Vance</a></span>
            <meta property="og:image" content="https://mock.example/image.jpg" />
          </html>
        `,
        { headers: { 'content-type': 'text/html' } }
      )
    })

    const result = await extractBookFromUrl('https://amazon.com/dp/12345', 'pub_1', mockFetch as any)
    expect(result.title).toContain('Shadows of the Forgotten')
    expect(result.author).toBe('K. L. Vance')
    expect(result.coverUrl).toBe('/api/files/ads/pub_1/cover.jpg')
  })

  it('throws a helpful error on invalid URLs', async () => {
    await expect(extractBookFromUrl('not-a-url', 'pub_1')).rejects.toThrow(/Invalid URL/)
  })

  it('refuses non-http schemes', async () => {
    await expect(extractBookFromUrl('file:///etc/passwd', 'pub_1')).rejects.toThrow(/http/)
  })

  it('refuses hosts that resolve to a private address', async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }] as never)
    const mockFetch = vi.fn()

    await expect(
      extractBookFromUrl('http://metadata.internal/latest', 'pub_1', mockFetch as never)
    ).rejects.toThrow(/cannot be reached/)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
