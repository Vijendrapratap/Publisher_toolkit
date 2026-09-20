import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { storeFile } from '@/lib/providers/storage'
import { extractAmazonFacts, isAmazonUrl } from './amazon'
import { attr, decodeHtmlEntities, innerHtmlById, metaContent, stripHtml } from './html'

/** Hard ceilings for anything fetched from a URL a user typed. */
const FETCH_TIMEOUT_MS = 15_000
const MAX_HTML_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase()
    if (v6 === '::1' || v6 === '::') return true
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return true
    // IPv4-mapped addresses carry the v4 rules with them.
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivateAddress(mapped[1]) : false
  }

  const [a, b] = ip.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local, including cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

/**
 * This endpoint fetches a URL the user supplies, from inside our network. Without
 * this check it is a proxy to every internal service and cloud metadata endpoint
 * the server can reach.
 */
async function assertPublicUrl(url: URL): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// links can be imported.')
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error('That address cannot be reached from here.')
  }
}

/** Reads a capped number of bytes, so a huge or endless response cannot exhaust memory. */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error('That page is too large to import.')

  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of res.body ?? []) {
    total += chunk.length
    if (total > maxBytes) throw new Error('That page is too large to import.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export interface ExtractedBookData {
  title: string
  author: string
  blurb: string
  coverUrl: string | null
  sourceUrl: string
  rating?: number | null
  reviewCount?: number | null
  /** Display price with its currency symbol, e.g. "$13.99". */
  price?: string | null
  asin?: string | null
  /** Bestseller categories, most specific first. Drives the ad preset. */
  categories?: string[]
  /** "About this item" bullets — the raw material for ad benefit lines. */
  bullets?: string[]
  printLength?: number | null
  publisher?: string | null
  publicationDate?: string | null
}

export type ParsedBook = Omit<ExtractedBookData, 'coverUrl'> & { rawCoverImageUrl: string | null }

/** Amazon puts the real title here; generic sites fall back to og:title. */
function extractTitle(html: string): string {
  const productTitle =
    innerHtmlById(html, 'span', 'productTitle') ?? innerHtmlById(html, 'span', 'ebooksProductTitle')
  const raw =
    (productTitle && stripHtml(productTitle)) ||
    metaContent(html, 'og:title') ||
    decodeHtmlEntities(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')

  return raw
    .replace(/^Amazon\.[a-z.]+\s*:\s*/i, '')
    .replace(/\s*:\s*Amazon\.[a-z.]+\s*:\s*Books$/i, '')
    .replace(/\s*:\s*(Kindle Store|Books)$/i, '')
    .trim()
}

function extractAuthor(html: string): string {
  const byline = innerHtmlById(html, 'div', 'bylineInfo')
  if (byline) {
    // The byline lists contributors as links; the first is the author.
    const contributor = /<a\b[^>]*class="[^"]*contributorNameID[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(byline)
    const anyLink = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(byline)
    const name = stripHtml(contributor?.[1] ?? anyLink?.[1] ?? '')
    if (name && !/^(visit|follow|see)/i.test(name)) return name
  }

  // Amazon also renders the byline without the wrapper on some templates.
  const notFaded = /class="author notFaded"[^>]*>[\s\S]{0,200}?<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(html)
  if (notFaded) {
    const name = stripHtml(notFaded[1])
    if (name) return name
  }

  const goodreads = /<span\b[^>]*class="[^"]*ContributorLink__name[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(html)
  if (goodreads) return stripHtml(goodreads[1])

  return metaContent(html, 'author') ?? ''
}

function extractBlurb(html: string): string {
  for (const id of ['bookDescription_feature_div', 'productDescription', 'editorialReviews_feature_div']) {
    const block = innerHtmlById(html, 'div', id)
    const text = block ? stripHtml(block) : ''
    if (text.length > 40) return text.replace(/\s*Read more\s*$/i, '').trim()
  }
  return metaContent(html, 'og:description') ?? metaContent(html, 'description') ?? ''
}

export function parseBookHtml(html: string, sourceUrl: string): ParsedBook {
  const amazon = isAmazonUrl(safeUrl(sourceUrl)) ? extractAmazonFacts(html, sourceUrl) : null

  return {
    title: extractTitle(html) || 'Untitled Book',
    author: extractAuthor(html) || 'Unknown Author',
    blurb: extractBlurb(html),
    rawCoverImageUrl: amazon?.coverImageUrl ?? metaContent(html, 'og:image') ?? extractGenericCover(html),
    sourceUrl,
    rating: amazon?.rating ?? null,
    reviewCount: amazon?.reviewCount ?? null,
    price: amazon?.price ?? null,
    asin: amazon?.asin ?? null,
    categories: amazon?.categories ?? [],
    bullets: amazon?.bullets ?? [],
    printLength: amazon?.printLength ?? null,
    publisher: amazon?.publisher ?? null,
    publicationDate: amazon?.publicationDate ?? null,
  }
}

function safeUrl(value: string): URL {
  try {
    return new URL(value)
  } catch {
    return new URL('https://example.invalid')
  }
}

/** Last resort for non-Amazon sites with no Open Graph image. */
function extractGenericCover(html: string): string | null {
  for (const [opening] of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(opening, 'src')
    if (src?.startsWith('http') && /cover|book|product/i.test(`${src} ${attr(opening, 'alt') ?? ''}`)) {
      return src
    }
  }
  return null
}

export async function extractBookFromUrl(
  urlStr: string,
  publisherId: string,
  fetchFn: typeof fetch = fetch
): Promise<ExtractedBookData> {
  let url: URL
  try {
    url = new URL(urlStr.trim())
  } catch {
    throw new Error('Invalid URL: please enter a valid website address.')
  }
  await assertPublicUrl(url)

  const res = await fetchFn(url.toString(), {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`Could not fetch details from this URL (HTTP ${res.status}).`)
  }

  const html = (await readCapped(res, MAX_HTML_BYTES)).toString('utf-8')
  const parsed = parseBookHtml(html, url.toString())

  const { rawCoverImageUrl, ...facts } = parsed
  return {
    ...facts,
    coverUrl: await storeCover(rawCoverImageUrl, url, publisherId, fetchFn),
  }
}

/** Cover download is best-effort: a missing image must not fail the import. */
async function storeCover(
  rawUrl: string | null,
  pageUrl: URL,
  publisherId: string,
  fetchFn: typeof fetch
): Promise<string | null> {
  if (!rawUrl) return null

  try {
    const imageUrl = new URL(rawUrl, pageUrl)
    await assertPublicUrl(imageUrl)

    const res = await fetchFn(imageUrl.toString(), {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null

    const buffer = await readCapped(res, MAX_IMAGE_BYTES)
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const stored = await storeFile(
      `ads/${publisherId}/scraped-covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
      buffer,
      contentType
    )
    return stored.url
  } catch (err) {
    console.warn('Could not store the scraped cover image:', err)
    return null
  }
}
