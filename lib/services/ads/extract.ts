import { createCanvas } from '@napi-rs/canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface ExtractedBookAssets {
  title: string | null
  author: string | null
  blurb: string | null
  frontCoverPng: Buffer | null
  backCoverPng: Buffer | null
}

async function renderPageToPng(page: any): Promise<Buffer> {
  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d')
  await page.render({ canvasContext: context as any, viewport }).promise
  return canvas.toBuffer('image/png')
}

async function extractPageText(page: any): Promise<string> {
  const content = await page.getTextContent()
  return content.items.map((item: any) => item.str).join(' ').trim()
}

export async function extractBookAssets(pdfBytes: Buffer): Promise<ExtractedBookAssets> {
  const empty: ExtractedBookAssets = {
    title: null,
    author: null,
    blurb: null,
    frontCoverPng: null,
    backCoverPng: null,
  }

  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise
  } catch {
    return empty
  }

  if (doc.numPages < 1) return empty

  let title: string | null = null
  let author: string | null = null
  let frontCoverPng: Buffer | null = null

  let firstPage: any = null
  try {
    firstPage = await doc.getPage(1)
  } catch {
    firstPage = null
  }

  if (firstPage) {
    try {
      const firstPageText = await extractPageText(firstPage)
      const lines = firstPageText.split(/\s{2,}|\n/).filter(Boolean)
      // Clamp to projectUpdateSchema's limits so a prefilled value is never
      // one the PATCH that saves it would reject.
      title = lines[0]?.slice(0, 200) ?? null
      const authorLine = lines.find((l) => /^by\s+/i.test(l))
      author = authorLine ? authorLine.replace(/^by\s+/i, '').slice(0, 200) : null
    } catch {
      title = null
      author = null
    }

    try {
      frontCoverPng = await renderPageToPng(firstPage)
    } catch {
      frontCoverPng = null
    }
  }

  let backCoverPng: Buffer | null = null
  let blurb: string | null = null
  if (doc.numPages > 1) {
    let lastPage: any = null
    try {
      lastPage = await doc.getPage(doc.numPages)
    } catch {
      lastPage = null
    }

    if (lastPage) {
      try {
        backCoverPng = await renderPageToPng(lastPage)
      } catch {
        backCoverPng = null
      }

      try {
        blurb = (await extractPageText(lastPage)).slice(0, 2000) || null
      } catch {
        blurb = null
      }
    }
  }

  return { title, author, blurb, frontCoverPng, backCoverPng }
}
