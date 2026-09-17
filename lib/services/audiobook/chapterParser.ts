export interface ParsedChapter {
  chapterNumber: number
  title: string
  content: string
}

const CHAPTER_REGEX =
  /(?:^|\n)(?:#{1,3}\s*)?(?:(chapter\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)[^\n]*)|(prologue[^\n]*)|(epilogue[^\n]*)|(part\s+(?:\d+|[ivxlcdm]+)[^\n]*)|(act\s+(?:\d+|[ivxlcdm]+)[^\n]*))/i

export function parseManuscriptChapters(text: string): ParsedChapter[] {
  const clean = text.trim()
  if (!clean) {
    return [{ chapterNumber: 1, title: 'Chapter 1: Introduction', content: 'Manuscript content pending.' }]
  }

  const lines = clean.split('\n')
  const chapters: ParsedChapter[] = []
  let currentTitle = ''
  let currentLines: string[] = []
  let chapterIndex = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const match = line.match(CHAPTER_REGEX)

    if (match && line.length < 120) {
      // If we already accumulated lines for a previous chapter, push it
      if (currentLines.length > 0) {
        chapters.push({
          chapterNumber: chapterIndex++,
          title: currentTitle || `Chapter ${chapterIndex - 1}`,
          content: currentLines.join('\n').trim(),
        })
        currentLines = []
      }
      currentTitle = line.replace(/^#{1,3}\s*/, '').trim()
    } else {
      currentLines.push(lines[i])
    }
  }

  // Push final chapter
  if (currentLines.length > 0) {
    chapters.push({
      chapterNumber: chapterIndex,
      title: currentTitle || (chapters.length === 0 ? 'Chapter 1: The Beginning' : `Chapter ${chapterIndex}`),
      content: currentLines.join('\n').trim(),
    })
  }

  // If no chapter headers were found or only 1 chapter with very long text (> 3500 words), split by word count
  if (chapters.length === 1 && chapters[0].content.split(/\s+/).length > 2500) {
    return chunkTextIntoChapters(chapters[0].content)
  }

  return chapters.filter((c) => c.content.trim().length > 0)
}

function chunkTextIntoChapters(text: string, wordsPerChapter = 1800): ParsedChapter[] {
  const paragraphs = text.split(/\n\s*\n/)
  const result: ParsedChapter[] = []
  let currentWords = 0
  let currentParagraphs: string[] = []
  let chapterNumber = 1

  for (const para of paragraphs) {
    const count = para.split(/\s+/).filter(Boolean).length
    currentParagraphs.push(para)
    currentWords += count

    if (currentWords >= wordsPerChapter) {
      result.push({
        chapterNumber,
        title: `Chapter ${chapterNumber}`,
        content: currentParagraphs.join('\n\n').trim(),
      })
      chapterNumber++
      currentParagraphs = []
      currentWords = 0
    }
  }

  if (currentParagraphs.length > 0) {
    result.push({
      chapterNumber,
      title: `Chapter ${chapterNumber}`,
      content: currentParagraphs.join('\n\n').trim(),
    })
  }

  return result
}

export async function extractPdfManuscriptText(pdfBytes: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise
    const pagesText: string[] = []
    const maxPages = Math.min(doc.numPages, 100)
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = content.items.map((item: any) => item.str).join(' ')
      if (text.trim()) {
        pagesText.push(text)
      }
    }
    return pagesText.join('\n\n')
  } catch (err) {
    console.warn('PDF text extraction error:', err)
    return ''
  }
}

