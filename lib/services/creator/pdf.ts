import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readStoredFile } from '@/lib/providers/storage'
import type { BookCreatorProjectData } from './types'

const PAGE_WIDTH = 612 // Standard US Letter width in points (8.5 inches)
const PAGE_HEIGHT = 792 // Standard US Letter height in points (11 inches)

const COLOR_DARK = rgb(0.12, 0.12, 0.14)
const COLOR_MUTED = rgb(0.45, 0.45, 0.5)
const COLOR_ACCENT = rgb(0.85, 0.35, 0.2)
const COLOR_LINE = rgb(0.86, 0.86, 0.89)
const COLOR_CARD_BG = rgb(0.97, 0.97, 0.98)

/**
 * Normalizes any text into WinAnsi / Latin-1 compatible characters for standard PDF fonts.
 */
function cleanPdfText(text: string): string {
  if (!text) return ''
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[•✦★☆]/g, '*')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
}

function drawTextSafe(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; size: number; font: PDFFont; color?: any }
) {
  const sanitized = cleanPdfText(text)
  if (!sanitized) return
  page.drawText(sanitized, options)
}

/**
 * Normalizes any image (remote URL, local /api/files path, data URI, JPG, PNG, WebP)
 * into a standard PNG buffer using @napi-rs/canvas.
 */
async function toPngBuffer(imageInput: string): Promise<Buffer | null> {
  try {
    let rawBuffer: Buffer
    if (imageInput.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.*)$/.exec(imageInput)
      if (!match) return null
      rawBuffer = Buffer.from(match[2], 'base64')
    } else {
      const { data } = await readStoredFile(imageInput)
      rawBuffer = data
    }

    const img = await loadImage(rawBuffer)
    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return canvas.toBuffer('image/png')
  } catch (err) {
    console.warn('[creator:pdf] could not process image', err)
    return null
  }
}

/**
 * Wraps text into lines that do not exceed maxWidth.
 */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const sanitized = cleanPdfText(text)
  const paragraphs = sanitized.split('\n')
  const lines: string[] = []

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('')
      continue
    }
    const words = para.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const width = font.widthOfTextAtSize(testLine, fontSize)
      if (width <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
  }
  return lines
}

/**
 * Draws wrapped text starting at (x, y) moving downwards. Returns the ending y position.
 */
function drawWrappedText(
  page: PDFPage,
  lines: string[],
  x: number,
  startY: number,
  font: PDFFont,
  fontSize: number,
  lineHeight: number,
  color = COLOR_DARK
): number {
  let y = startY
  for (const line of lines) {
    if (line) {
      drawTextSafe(page, line, { x, y, size: fontSize, font, color })
    }
    y -= lineHeight
  }
  return y
}

/**
 * Generates a complete, ready-to-print PDF with cover and interior pages/images.
 */
export async function generateBookPdf(project: BookCreatorProjectData): Promise<Buffer> {
  const doc = await PDFDocument.create()

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontSerif = await doc.embedFont(StandardFonts.TimesRoman)
  const fontMono = await doc.embedFont(StandardFonts.CourierBold)

  // ==========================================
  // 1. FRONT COVER PAGE
  // ==========================================
  const coverPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  // Decorative frame border
  coverPage.drawRectangle({
    x: 24,
    y: 24,
    width: PAGE_WIDTH - 48,
    height: PAGE_HEIGHT - 48,
    borderColor: COLOR_LINE,
    borderWidth: 2,
    color: COLOR_CARD_BG,
  })

  // Badge at top
  const badgeText = `${project.bookType.toUpperCase().replace('_', ' ')} - PUBLISHER TOOLKIT`
  drawTextSafe(coverPage, badgeText, {
    x: 48,
    y: PAGE_HEIGHT - 65,
    size: 10,
    font: fontBold,
    color: COLOR_ACCENT,
  })

  // Title
  const titleText = project.title || 'Untitled Book'
  const titleLines = wrapText(titleText, PAGE_WIDTH - 96, fontBold, 26)
  let yPos = PAGE_HEIGHT - 105
  yPos = drawWrappedText(coverPage, titleLines, 48, yPos, fontBold, 26, 32, COLOR_DARK)

  // Subtitle
  if (project.subtitle) {
    const subtitleLines = wrapText(project.subtitle, PAGE_WIDTH - 96, fontRegular, 13)
    yPos -= 4
    yPos = drawWrappedText(coverPage, subtitleLines, 48, yPos, fontRegular, 13, 18, COLOR_MUTED)
  }

  // Cover Image
  let coverEmbedded = false
  if (project.coverImageUrl) {
    const png = await toPngBuffer(project.coverImageUrl)
    if (png) {
      try {
        const coverImg = await doc.embedPng(png)
        const maxImgWidth = PAGE_WIDTH - 96
        const maxImgHeight = Math.max(200, yPos - 120)
        const scale = Math.min(maxImgWidth / coverImg.width, maxImgHeight / coverImg.height)
        const displayWidth = coverImg.width * scale
        const displayHeight = coverImg.height * scale
        const imgX = (PAGE_WIDTH - displayWidth) / 2
        const imgY = yPos - displayHeight - 16

        coverPage.drawImage(coverImg, {
          x: imgX,
          y: imgY,
          width: displayWidth,
          height: displayHeight,
        })
        coverEmbedded = true
      } catch (err) {
        console.warn('[creator:pdf] failed to embed cover image', err)
      }
    }
  }

  if (!coverEmbedded) {
    // Draw stylish decorative art placeholder box
    const boxY = 120
    const boxHeight = Math.max(220, yPos - 150)
    coverPage.drawRectangle({
      x: 48,
      y: boxY,
      width: PAGE_WIDTH - 96,
      height: boxHeight,
      color: rgb(0.92, 0.94, 0.98),
      borderColor: rgb(0.8, 0.85, 0.92),
      borderWidth: 1,
    })
    drawTextSafe(coverPage, '* Illustrated Edition *', {
      x: PAGE_WIDTH / 2 - 70,
      y: boxY + boxHeight / 2,
      size: 14,
      font: fontBold,
      color: COLOR_ACCENT,
    })
  }

  // Author at bottom
  const authorText = `By ${project.author || 'Author'}`
  drawTextSafe(coverPage, authorText, {
    x: 48,
    y: 56,
    size: 14,
    font: fontBold,
    color: COLOR_DARK,
  })

  // ==========================================
  // 2. INTERIOR CONTENT PAGES
  // ==========================================
  const content = project.content

  if (content) {
    if (content.type === 'children') {
      for (const page of content.pages) {
        const pDoc = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

        // Spread header
        const pageHeader = `PAGE ${page.pageNumber}` + (page.spreadHeading ? ` - ${page.spreadHeading}` : '')
        drawTextSafe(pDoc, pageHeader.toUpperCase(), {
          x: 48,
          y: PAGE_HEIGHT - 50,
          size: 11,
          font: fontBold,
          color: COLOR_ACCENT,
        })

        let currentY = PAGE_HEIGHT - 75

        // Illustration
        if (page.generatedImageUrl) {
          const png = await toPngBuffer(page.generatedImageUrl)
          if (png) {
            try {
              const img = await doc.embedPng(png)
              const maxW = PAGE_WIDTH - 96
              const maxH = 380
              const scale = Math.min(maxW / img.width, maxH / img.height)
              const w = img.width * scale
              const h = img.height * scale
              const imgX = (PAGE_WIDTH - w) / 2
              const imgY = currentY - h

              pDoc.drawImage(img, { x: imgX, y: imgY, width: w, height: h })
              currentY = imgY - 24
            } catch (err) {
              console.warn(`[creator:pdf] failed to embed children image page ${page.pageNumber}`, err)
            }
          }
        }

        // Story prose
        const storyLines = wrapText(page.storyText, PAGE_WIDTH - 96, fontSerif, 14)
        drawWrappedText(pDoc, storyLines, 48, currentY, fontSerif, 14, 22, COLOR_DARK)

        // Footer
        drawTextSafe(pDoc, `${page.pageNumber} / ${content.pages.length}`, {
          x: PAGE_WIDTH / 2 - 15,
          y: 36,
          size: 10,
          font: fontRegular,
          color: COLOR_MUTED,
        })
      }
    } else if (content.type === 'coloring') {
      for (const page of content.pages) {
        const pDoc = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

        // Title at top
        drawTextSafe(pDoc, `Page ${page.pageNumber} - ${page.title}`, {
          x: 48,
          y: PAGE_HEIGHT - 45,
          size: 13,
          font: fontBold,
          color: COLOR_DARK,
        })

        const imageAreaX = 48
        const imageAreaY = 56
        const imageAreaW = PAGE_WIDTH - 96
        const imageAreaH = PAGE_HEIGHT - 116

        // Printable line art border
        pDoc.drawRectangle({
          x: imageAreaX,
          y: imageAreaY,
          width: imageAreaW,
          height: imageAreaH,
          borderColor: COLOR_LINE,
          borderWidth: 1,
        })

        if (page.generatedImageUrl) {
          const png = await toPngBuffer(page.generatedImageUrl)
          if (png) {
            try {
              const img = await doc.embedPng(png)
              const scale = Math.min(imageAreaW / img.width, imageAreaH / img.height)
              const w = img.width * scale
              const h = img.height * scale
              const imgX = imageAreaX + (imageAreaW - w) / 2
              const imgY = imageAreaY + (imageAreaH - h) / 2

              pDoc.drawImage(img, { x: imgX, y: imgY, width: w, height: h })
            } catch (err) {
              console.warn(`[creator:pdf] failed to embed coloring page ${page.pageNumber}`, err)
            }
          }
        } else {
          // Placeholder line art box
          drawTextSafe(pDoc, `[Coloring Page Line Art: ${page.title}]`, {
            x: PAGE_WIDTH / 2 - 100,
            y: imageAreaY + imageAreaH / 2,
            size: 12,
            font: fontRegular,
            color: COLOR_MUTED,
          })
        }

        // Footer
        drawTextSafe(pDoc, `Page ${page.pageNumber}`, {
          x: PAGE_WIDTH / 2 - 18,
          y: 30,
          size: 10,
          font: fontRegular,
          color: COLOR_MUTED,
        })
      }
    } else if (content.type === 'word_game') {
      for (const puzzle of content.wordSearches) {
        const pDoc = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

        drawTextSafe(pDoc, `WORD SEARCH #${puzzle.puzzleNumber}`, {
          x: 48,
          y: PAGE_HEIGHT - 45,
          size: 12,
          font: fontBold,
          color: COLOR_ACCENT,
        })

        drawTextSafe(pDoc, puzzle.title, {
          x: 48,
          y: PAGE_HEIGHT - 65,
          size: 18,
          font: fontBold,
          color: COLOR_DARK,
        })

        drawTextSafe(pDoc, `Theme: ${puzzle.theme}`, {
          x: 48,
          y: PAGE_HEIGHT - 82,
          size: 11,
          font: fontRegular,
          color: COLOR_MUTED,
        })

        let currentY = PAGE_HEIGHT - 100

        // Optional theme illustration
        if (puzzle.illustrationUrl) {
          const png = await toPngBuffer(puzzle.illustrationUrl)
          if (png) {
            try {
              const img = await doc.embedPng(png)
              const h = 130
              const w = Math.min(PAGE_WIDTH - 96, (img.width / img.height) * h)
              const imgX = (PAGE_WIDTH - w) / 2
              pDoc.drawImage(img, { x: imgX, y: currentY - h, width: w, height: h })
              currentY -= h + 16
            } catch (err) {
              console.warn('[creator:pdf] failed to embed puzzle image', err)
            }
          }
        }

        // Letter grid matrix
        const gridSize = puzzle.gridSize || puzzle.grid.length
        const cellSize = Math.min(24, Math.floor((PAGE_WIDTH - 96) / gridSize))
        const totalGridWidth = cellSize * gridSize
        const gridStartX = (PAGE_WIDTH - totalGridWidth) / 2
        const gridStartY = currentY - 10

        for (let r = 0; r < puzzle.grid.length; r++) {
          for (let c = 0; c < puzzle.grid[r].length; c++) {
            const cellX = gridStartX + c * cellSize
            const cellY = gridStartY - (r + 1) * cellSize

            pDoc.drawRectangle({
              x: cellX,
              y: cellY,
              width: cellSize,
              height: cellSize,
              borderColor: COLOR_LINE,
              borderWidth: 0.5,
              color: rgb(0.98, 0.98, 0.99),
            })

            const char = puzzle.grid[r][c] || ''
            drawTextSafe(pDoc, char, {
              x: cellX + cellSize / 2 - 4,
              y: cellY + cellSize / 2 - 4,
              size: Math.max(9, cellSize - 10),
              font: fontMono,
              color: COLOR_DARK,
            })
          }
        }

        currentY = gridStartY - puzzle.grid.length * cellSize - 24

        // Word Bank List
        drawTextSafe(pDoc, 'WORD BANK:', {
          x: 48,
          y: currentY,
          size: 11,
          font: fontBold,
          color: COLOR_DARK,
        })
        currentY -= 16

        // Draw words in 3 columns
        const colWidth = (PAGE_WIDTH - 96) / 3
        puzzle.wordList.forEach((word, idx) => {
          const col = idx % 3
          const row = Math.floor(idx / 3)
          const wx = 48 + col * colWidth
          const wy = currentY - row * 16

          drawTextSafe(pDoc, `- ${word}`, {
            x: wx,
            y: wy,
            size: 10,
            font: fontRegular,
            color: COLOR_DARK,
          })
        })

        // Fun Fact box if present
        if (puzzle.hiddenFact) {
          const factY = 48
          pDoc.drawRectangle({
            x: 48,
            y: factY,
            width: PAGE_WIDTH - 96,
            height: 38,
            borderColor: rgb(0.9, 0.75, 0.5),
            borderWidth: 1,
            color: rgb(0.99, 0.98, 0.95),
          })
          drawTextSafe(pDoc, `Did You Know? ${puzzle.hiddenFact}`, {
            x: 58,
            y: factY + 14,
            size: 9,
            font: fontRegular,
            color: COLOR_DARK,
          })
        }
      }
    } else if (content.type === 'short_story') {
      const pDoc = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

      drawTextSafe(pDoc, 'STORY BOOK', {
        x: 48,
        y: PAGE_HEIGHT - 45,
        size: 11,
        font: fontBold,
        color: COLOR_ACCENT,
      })

      drawTextSafe(pDoc, content.story.title, {
        x: 48,
        y: PAGE_HEIGHT - 70,
        size: 20,
        font: fontBold,
        color: COLOR_DARK,
      })

      drawTextSafe(pDoc, `Theme: ${content.story.theme}`, {
        x: 48,
        y: PAGE_HEIGHT - 88,
        size: 11,
        font: fontRegular,
        color: COLOR_MUTED,
      })

      let currentY = PAGE_HEIGHT - 110

      // Scene illustration if present
      if (content.story.illustrationUrl) {
        const png = await toPngBuffer(content.story.illustrationUrl)
        if (png) {
          try {
            const img = await doc.embedPng(png)
            const h = 220
            const w = Math.min(PAGE_WIDTH - 96, (img.width / img.height) * h)
            const imgX = (PAGE_WIDTH - w) / 2
            pDoc.drawImage(img, { x: imgX, y: currentY - h, width: w, height: h })
            currentY -= h + 20
          } catch (err) {
            console.warn('[creator:pdf] failed to embed story image', err)
          }
        }
      }

      // Story text
      const storyLines = wrapText(content.story.storyText, PAGE_WIDTH - 96, fontSerif, 12)
      let activePage = pDoc
      for (const line of storyLines) {
        if (currentY < 60) {
          activePage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
          currentY = PAGE_HEIGHT - 60
        }
        if (line) {
          drawTextSafe(activePage, line, {
            x: 48,
            y: currentY,
            size: 12,
            font: fontSerif,
            color: COLOR_DARK,
          })
        }
        currentY -= 18
      }
    } else if (content.type === 'novel_chapter') {
      // Legacy support for existing novel chapters
      for (const chapter of content.novel.chapters) {
        const pDoc = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        drawTextSafe(pDoc, `CHAPTER ${chapter.chapterNumber}: ${chapter.title.toUpperCase()}`, {
          x: 48,
          y: PAGE_HEIGHT - 50,
          size: 14,
          font: fontBold,
          color: COLOR_DARK,
        })

        let currentY = PAGE_HEIGHT - 80
        const prose = chapter.content || chapter.summary
        const lines = wrapText(prose, PAGE_WIDTH - 96, fontSerif, 12)
        let activePage = pDoc
        for (const line of lines) {
          if (currentY < 60) {
            activePage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
            currentY = PAGE_HEIGHT - 60
          }
          if (line) {
            drawTextSafe(activePage, line, {
              x: 48,
              y: currentY,
              size: 12,
              font: fontSerif,
              color: COLOR_DARK,
            })
          }
          currentY -= 18
        }
      }
    }
  }

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
