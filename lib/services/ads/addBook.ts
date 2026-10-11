import type { ExtractedBookData } from '@/lib/services/extract/urlExtractor'

/** Multipart body for "Upload a cover": the fields POST /api/ads/projects reads for a book without a PDF. */
export function buildCoverUploadForm(input: { title: string; author: string; cover: File; insidePages: File[] }): FormData {
  const form = new FormData()
  form.append('title', input.title.trim())
  form.append('author', input.author.trim())
  form.append('frontCover', input.cover)
  // Inside pages feed A+ feature modules and the video ad's scenes.
  for (const page of input.insidePages) form.append('interiorImages', page)
  return form
}

/** JSON body for "Paste a store link": every fact the link gave us, with the title and author as the person left them. */
export function buildLinkBookBody(
  extracted: Pick<ExtractedBookData, 'title' | 'blurb' | 'coverUrl' | 'sourceUrl' | 'rating' | 'reviewCount' | 'price' | 'categories' | 'bullets'>,
  edited: { title: string; author: string }
) {
  return {
    title: edited.title.trim() || extracted.title,
    author: edited.author.trim(),
    blurb: extracted.blurb,
    frontCoverUrl: extracted.coverUrl,
    sourceUrl: extracted.sourceUrl,
    rating: extracted.rating ?? null,
    reviewCount: extracted.reviewCount ?? null,
    price: extracted.price ?? null,
    categories: extracted.categories ?? [],
    bullets: extracted.bullets ?? [],
  }
}
