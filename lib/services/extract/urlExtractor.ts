import { storeFile } from '@/lib/providers/storage'

export interface ExtractedBookData {
  title: string
  author: string
  blurb: string
  coverUrl: string | null
  sourceUrl: string
  rating?: number | null
  reviewCount?: number | null
  badge?: string | null
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

export function parseBookHtml(html: string, sourceUrl: string): Omit<ExtractedBookData, 'coverUrl'> & { rawCoverImageUrl: string | null } {
  let title = ''
  let author = ''
  let blurb = ''
  let rawCoverImageUrl: string | null = null
  let rating: number | null = null
  let reviewCount: number | null = null

  // 1. Title Extraction
  const amazonTitleMatch = html.match(/<span\s+id=["'](?:productTitle|ebooksProductTitle)["'][^>]*>([\s\S]*?)<\/span>/i)
  if (amazonTitleMatch) {
    title = stripHtml(amazonTitleMatch[1])
  }

  if (!title) {
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)
    if (ogTitleMatch) {
      title = decodeHtmlEntities(ogTitleMatch[1])
    }
  }

  if (!title) {
    const titleTagMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
    if (titleTagMatch) {
      title = decodeHtmlEntities(titleTagMatch[1])
    }
  }

  // Clean Amazon / Goodreads branding suffixes from title
  title = title
    .replace(/^Amazon\.com\s*:\s*/i, '')
    .replace(/\s*:\s*Amazon\.com\s*:\s*Books$/i, '')
    .replace(/\s*:\s*Kindle Store$/i, '')
    .replace(/\s*by\s+[^:]+$/i, '')
    .trim()

  // 2. Author Extraction
  const authorTagMatch =
    html.match(/<span\s+class=["']author\s+notFaded["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/<div\s+id=["']bylineInfo["'][^>]*>[\s\S]*?<a[^>]*class=["'][^"']*contributorNameID[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/<div\s+id=["']bylineInfo["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/<span\s+class=["']ContributorLink__name["'][^>]*>([\s\S]*?)<\/span>/i)

  if (authorTagMatch) {
    author = stripHtml(authorTagMatch[1])
  }

  if (!author) {
    const metaAuthor =
      html.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']author["']/i)
    if (metaAuthor) {
      author = decodeHtmlEntities(metaAuthor[1])
    }
  }

  // 3. Blurb / Description Extraction
  const descDivMatch =
    html.match(/<div\s+id=["']bookDescription_feature_div["'][^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<div\s+data-testid=["']description["'][^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<div\s+id=["']feature-bullets["'][^>]*>([\s\S]*?)<\/div>/i)

  if (descDivMatch) {
    blurb = stripHtml(descDivMatch[1])
  }

  if (!blurb) {
    const metaDesc =
      html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i)
    if (metaDesc) {
      blurb = decodeHtmlEntities(metaDesc[1])
    }
  }

  // 4. Cover Image Extraction
  const imgMatch =
    html.match(/<img[^>]+id=["'](?:landingImage|imgBlkFront|ebooks-img-canvas)["'][^>]+data-old-hires=["']([^"']+)["']/i) ||
    html.match(/<img[^>]+id=["'](?:landingImage|imgBlkFront|ebooks-img-canvas)["'][^>]+src=["']([^"']+)["']/i) ||
    html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i)

  if (imgMatch) {
    rawCoverImageUrl = imgMatch[1]
  }

  // 5. Rating & Reviews
  const ratingMatch = html.match(/([0-5](?:\.[0-9])?)\s+out of 5 stars/i)
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1])
  }

  const reviewMatch = html.match(/([\d,]+)\s+ratings?/i)
  if (reviewMatch) {
    reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10)
  }

  return {
    title: title || 'Untitled Book',
    author: author || 'Unknown Author',
    blurb: blurb || '',
    rawCoverImageUrl,
    sourceUrl,
    rating,
    reviewCount,
  }
}

export async function extractBookFromUrl(
  urlStr: string,
  publisherId: string,
  fetchFn: typeof fetch = fetch
): Promise<ExtractedBookData> {
  let url: URL
  try {
    url = new URL(urlStr.trim())
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid URL protocol. Use http:// or https://')
    }
  } catch (err: any) {
    throw new Error(`Invalid URL: ${err.message || 'Please enter a valid website address'}`)
  }

  const res = await fetchFn(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!res.ok) {
    throw new Error(`Could not fetch details from this URL (HTTP ${res.status}).`)
  }

  const html = await res.text()
  const parsed = parseBookHtml(html, url.toString())

  let coverUrl: string | null = null
  if (parsed.rawCoverImageUrl) {
    try {
      const imgRes = await fetchFn(parsed.rawCoverImageUrl)
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
        const stored = await storeFile(
          `ads/${publisherId}/scraped-covers/${Date.now()}.${ext}`,
          buffer,
          contentType
        )
        coverUrl = stored.url
      }
    } catch (imgErr) {
      console.warn('Failed to download scraped cover image locally, using external URL fallback:', imgErr)
      coverUrl = parsed.rawCoverImageUrl
    }
  }

  return {
    title: parsed.title,
    author: parsed.author,
    blurb: parsed.blurb,
    coverUrl,
    sourceUrl: parsed.sourceUrl,
    rating: parsed.rating,
    reviewCount: parsed.reviewCount,
  }
}
