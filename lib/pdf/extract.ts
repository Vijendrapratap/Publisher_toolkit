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

  const firstPage = await doc.getPage(1)
  const firstPageText = await extractPageText(firstPage)
  const lines = firstPageText.split(/\s{2,}|\n/).filter(Boolean)

  const title = lines[0] ?? null
  const authorLine = lines.find((l) => /^by\s+/i.test(l))
  const author = authorLine ? authorLine.replace(/^by\s+/i, '') : null

  let frontCoverPng: Buffer | null = null
  try {
    frontCoverPng = await renderPageToPng(firstPage)
  } catch {
    frontCoverPng = null
  }

  let backCoverPng: Buffer | null = null
  let blurb: string | null = null
  if (doc.numPages > 1) {
    const lastPage = await doc.getPage(doc.numPages)
    try {
      backCoverPng = await renderPageToPng(lastPage)
    } catch {
      backCoverPng = null
    }
    blurb = (await extractPageText(lastPage)) || null
  }

  return { title, author, blurb, frontCoverPng, backCoverPng }
}
