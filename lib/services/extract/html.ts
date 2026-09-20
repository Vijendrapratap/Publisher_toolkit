/**
 * Small, order-independent HTML helpers.
 *
 * The previous extractor matched whole tags with regexes like
 * `<img[^>]+id="landingImage"[^>]+src="..."`, which silently returns nothing
 * the moment the site reorders its attributes — which is exactly what Amazon
 * did, so every cover came back null. These helpers find the tag first, then
 * read attributes from it in any order.
 */

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    // Ampersand last: decoding it first would turn "&amp;lt;" into "<".
    .replace(/&amp;/g, '&')
    .trim()
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Reads one attribute off a single tag's source, in any position. */
export function attr(tagHtml: string, name: string): string | null {
  // `\b` alone would let `data-src` satisfy a request for `src`, because the
  // hyphen counts as a word boundary — and Amazon tags carry both.
  const match = new RegExp(`(?<![\\w-])${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tagHtml)
  if (!match) return null
  return decodeHtmlEntities(match[2] ?? match[3] ?? '')
}

/** The opening tag whose attributes include the given id, whatever their order. */
export function findTagById(html: string, tag: string, id: string): string | null {
  const openings = html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))
  for (const [opening] of openings) {
    if (attr(opening, 'id') === id) return opening
  }
  return null
}

/** The opening tag whose class list contains the given class name. */
export function findTagByClass(html: string, tag: string, className: string): string | null {
  const openings = html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))
  for (const [opening] of openings) {
    if (attr(opening, 'class')?.split(/\s+/).includes(className)) return opening
  }
  return null
}

/**
 * The inner HTML of the element with this id, brace-matched on nesting so a
 * `[\\s\\S]*?</div>` never stops at the first descendant's closing tag.
 */
export function innerHtmlById(html: string, tag: string, id: string): string | null {
  const opening = findTagById(html, tag, id)
  if (!opening) return null

  const contentStart = html.indexOf(opening) + opening.length
  let depth = 1
  const scanner = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  scanner.lastIndex = contentStart

  for (let match = scanner.exec(html); match; match = scanner.exec(html)) {
    depth += match[1] ? -1 : 1
    if (depth === 0) return html.slice(contentStart, match.index)
  }
  return null
}

/** The first `<meta>` content for a property or name, in either attribute order. */
export function metaContent(html: string, key: string): string | null {
  for (const [opening] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attr(opening, 'property') === key || attr(opening, 'name') === key) {
      const content = attr(opening, 'content')
      if (content) return content
    }
  }
  return null
}
