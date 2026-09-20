import { attr, decodeHtmlEntities, findTagById, innerHtmlById, stripHtml } from './html'

/**
 * Amazon-specific field extraction.
 *
 * Everything here is scoped to a known element. The previous code searched the
 * whole 2MB document for patterns like `([\d,]+)\s+ratings?`, which matched a
 * carousel item and reported 935 reviews for a book with 149,911.
 */

export interface AmazonFacts {
  coverImageUrl: string | null
  rating: number | null
  reviewCount: number | null
  /** Display price including its currency symbol, e.g. "$13.99". */
  price: string | null
  asin: string | null
  /** Bestseller categories, most specific first — the best genre signal we get. */
  categories: string[]
  /** "About this item" / editorial bullets, which make strong ad benefit lines. */
  bullets: string[]
  printLength: number | null
  publisher: string | null
  publicationDate: string | null
  format: string | null
}

/**
 * `data-a-dynamic-image` maps every rendition to its [w,h]. Taking the widest
 * gets a print-quality cover instead of the ~340px thumbnail in `src`.
 */
export function largestDynamicImage(value: string | null): string | null {
  if (!value) return null
  try {
    const sizes = JSON.parse(value) as Record<string, [number, number]>
    let best: { url: string; width: number } | null = null
    for (const [url, dimensions] of Object.entries(sizes)) {
      const width = Array.isArray(dimensions) ? Number(dimensions[0]) : 0
      if (!best || width > best.width) best = { url, width }
    }
    return best?.url ?? null
  } catch {
    return null
  }
}

/** Rewrites Amazon's `_SY342_`-style rendition suffix to ask for a large image. */
export function upgradeImageUrl(url: string | null, targetPx = 1600): string | null {
  if (!url) return null
  return url.replace(/\._[A-Z0-9_,]+_\.(jpg|png|webp)$/i, `._SL${targetPx}_.$1`)
}

export function extractCover(html: string): string | null {
  for (const id of ['landingImage', 'imgBlkFront', 'ebooksImgBlkFront', 'main-image']) {
    const tag = findTagById(html, 'img', id)
    if (!tag) continue
    const url =
      largestDynamicImage(attr(tag, 'data-a-dynamic-image')) ??
      attr(tag, 'data-old-hires') ??
      attr(tag, 'src')
    if (url?.startsWith('http')) return upgradeImageUrl(url)
  }
  return null
}

export function extractRating(html: string): number | null {
  // "4.8 out of 5 stars", scoped to the review popover rather than the page.
  const popover = findTagById(html, 'span', 'acrPopover') ?? findTagById(html, 'i', 'acrPopover')
  const title = popover ? attr(popover, 'title') : null
  const match = /([0-5](?:\.\d)?)\s+out of 5/i.exec(title ?? '')
  return match ? Number(match[1]) : null
}

export function extractReviewCount(html: string): number | null {
  const tag = findTagById(html, 'span', 'acrCustomerReviewText')
  if (!tag) return null

  // aria-label carries the unabbreviated number; the visible text can read
  // "1.2K". Either way it stays scoped to this one widget.
  const source = attr(tag, 'aria-label') ?? innerHtmlById(html, 'span', 'acrCustomerReviewText') ?? ''
  const digits = /([\d,]+)/.exec(source)
  return digits ? Number(digits[1].replace(/,/g, '')) : null
}

export function extractPrice(html: string): string | null {
  const block = innerHtmlById(html, 'div', 'corePrice_feature_div') ?? html
  // The screen-reader copy is the whole formatted price when present.
  const offscreen = /class="a-offscreen"[^>]*>\s*([^<\s][^<]*)</i.exec(block)
  if (offscreen) return decodeHtmlEntities(offscreen[1]).trim()

  const symbol = /class="a-price-symbol"[^>]*>([^<]*)</i.exec(block)?.[1] ?? ''
  const whole = /class="a-price-whole"[^>]*>([\d,]+)/i.exec(block)?.[1]
  const fraction = /class="a-price-fraction"[^>]*>(\d+)/i.exec(block)?.[1]
  if (!whole) return null
  return `${decodeHtmlEntities(symbol)}${whole}${fraction ? `.${fraction}` : ''}`.trim()
}

export function extractAsin(html: string, url: string): string | null {
  const fromUrl = /\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i.exec(url)
  if (fromUrl) return fromUrl[1].toUpperCase()
  const input = findTagById(html, 'input', 'ASIN') ?? findTagById(html, 'input', 'asin')
  return input ? attr(input, 'value') : null
}

export function extractCategories(html: string): string[] {
  // "Best Sellers Rank: #62 in Books ... #1 in Habit Formation Self-Help"
  const section = /Best Sellers Rank:?([\s\S]{0,1200})/i.exec(html)?.[1]
  if (!section) return []

  const categories: string[] = []
  for (const [, name] of section.matchAll(/#[\d,]+\s+in\s+(?:<a[^>]*>)?([^<(]{2,60})/gi)) {
    const cleaned = decodeHtmlEntities(name).replace(/\s+/g, ' ').trim()
    // "Books" is the root shelf and tells us nothing about the genre.
    if (cleaned && cleaned.toLowerCase() !== 'books' && !categories.includes(cleaned)) {
      categories.push(cleaned)
    }
  }
  return categories.slice(0, 5)
}

export function extractBullets(html: string): string[] {
  const block =
    innerHtmlById(html, 'div', 'featurebullets_feature_div') ??
    innerHtmlById(html, 'div', 'feature-bullets') ??
    innerHtmlById(html, 'div', 'bookDescription_feature_div')
  if (!block) return []

  const bullets: string[] = []
  for (const [, item] of block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripHtml(item)
    if (text.length >= 10 && text.length <= 220 && !/see more|read more/i.test(text)) {
      bullets.push(text)
    }
  }
  return bullets.slice(0, 8)
}

/**
 * Book facts live in a "rich product information" carousel whose label and
 * value sit in sibling blocks, so match the pair rather than a fixed offset.
 */
function richProductValue(html: string, label: string): string | null {
  const pattern = new RegExp(
    `${label}</span>[\\s\\S]{0,600}?rpi-attribute-value"[^>]*>\\s*<span[^>]*>([^<]{1,80})<`,
    'i'
  )
  const match = pattern.exec(html)
  return match ? decodeHtmlEntities(match[1]).trim() : null
}

function detailValue(html: string, label: string): string | null {
  const pattern = new RegExp(
    `${label}\\s*:?\\s*</span>\\s*<span[^>]*>([^<]{1,120})<`,
    'i'
  )
  const match = pattern.exec(html)
  return match ? decodeHtmlEntities(match[1]).trim() : null
}

export function extractBookFacts(html: string): Pick<
  AmazonFacts,
  'printLength' | 'publisher' | 'publicationDate' | 'format'
> {
  const lengthText = richProductValue(html, 'Print length') ?? detailValue(html, 'Print length')
  const pages = lengthText ? /(\d[\d,]*)/.exec(lengthText) : null

  return {
    printLength: pages ? Number(pages[1].replace(/,/g, '')) : null,
    publisher: richProductValue(html, 'Publisher') ?? detailValue(html, 'Publisher'),
    publicationDate:
      richProductValue(html, 'Publication date') ?? detailValue(html, 'Publication date'),
    format: richProductValue(html, 'Print length') ? 'Print' : detailValue(html, 'Format'),
  }
}

export function isAmazonUrl(url: URL): boolean {
  return /(^|\.)amazon\.[a-z.]{2,6}$/i.test(url.hostname)
}

export function extractAmazonFacts(html: string, url: string): AmazonFacts {
  return {
    coverImageUrl: extractCover(html),
    rating: extractRating(html),
    reviewCount: extractReviewCount(html),
    price: extractPrice(html),
    asin: extractAsin(html, url),
    categories: extractCategories(html),
    bullets: extractBullets(html),
    ...extractBookFacts(html),
  }
}
