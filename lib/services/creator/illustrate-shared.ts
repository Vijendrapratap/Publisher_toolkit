import type { GeneratedBookContent } from './types'
import { describeStyle } from './options'

/**
 * The pure "how many images / which prompts" logic for illustrating a book
 * project. No AI or storage imports here — this module is safe to import
 * from client components (e.g. to show the credit total before the click),
 * as well as from the server-side `illustrate.ts`.
 */

/**
 * Each page is drawn by a separate, memoryless model call, so a character
 * described only on page one comes back as a different animal on page four.
 * Restating a locked description in every prompt is what holds a book together.
 */
export function buildStyleBible(content: GeneratedBookContent, styleTheme: string): string {
  const parts = [`Consistent art style throughout: ${describeStyle(styleTheme)}.`]

  if (content.type === 'children') {
    const focuses = content.pages
      .map((p) => p.characterFocus)
      .filter((f): f is string => Boolean(f))
    // The first page introduces the cast; later pages must match it.
    const cast = [...new Set(focuses)].slice(0, 3)
    if (cast.length > 0) {
      parts.push(`Recurring characters, identical on every page: ${cast.join('; ')}.`)
    }
  }

  parts.push('Same colour palette, same line quality and the same level of detail on every page.')
  return parts.join(' ')
}

/** Every prompt this project needs, paired with where the result belongs. */
export function collectPrompts(
  content: GeneratedBookContent,
  bible: string
): { key: string; prompt: string; apply: (url: string) => void }[] {
  if (content.type === 'children') {
    return content.pages.map((page) => ({
      key: `page-${page.pageNumber}`,
      prompt: `${page.illustrationPrompt} ${bible} No text, letters or words anywhere in the image.`,
      apply: (url) => {
        page.generatedImageUrl = url
      },
    }))
  }

  if (content.type === 'coloring') {
    return content.pages.map((page) => ({
      key: `page-${page.pageNumber}`,
      prompt: [
        page.lineArtPrompt,
        bible,
        // These pages are printed and coloured by hand, so anything but closed
        // black outlines on white is unusable.
        'Pure black outlines on a pure white background. No shading, no gradients, no grey fill, no colour, no text.',
      ].join(' '),
      apply: (url) => {
        page.generatedImageUrl = url
      },
    }))
  }

  if (content.type === 'word_game') {
    return content.wordSearches.map((ws) => ({
      key: `puzzle-${ws.puzzleNumber}`,
      prompt: [
        ws.illustrationPrompt || `Charming children book illustration of ${ws.theme}.`,
        bible,
        'Activity book puzzle theme artwork. No text, letters, grids or numbers.',
      ].join(' '),
      apply: (url) => {
        ws.illustrationUrl = url
      },
    }))
  }

  if (content.type === 'short_story') {
    return [
      {
        key: 'story-scene-1',
        prompt: [
          content.story.illustrationPrompt || `Atmospheric story illustration for "${content.story.title}".`,
          bible,
          'Evocative narrative artwork. No text, letters, or title in the image.',
        ].join(' '),
        apply: (url) => {
          content.story.illustrationUrl = url
        },
      },
    ]
  }

  if (content.type === 'novel_chapter') {
    return content.novel.chapters.slice(0, 5).map((ch) => ({
      key: `chapter-${ch.chapterNumber}`,
      prompt: [
        `Chapter illustration for "${ch.title}": ${ch.summary}.`,
        bible,
        'No text, no letters.',
      ].join(' '),
      apply: (url) => {
        ch.illustrationUrl = url
      },
    }))
  }

  return []
}

export function hasImage(content: GeneratedBookContent, key: string): boolean {
  if (content.type === 'children' || content.type === 'coloring') {
    const pageNumber = Number(key.replace('page-', ''))
    return Boolean(content.pages.find((p) => p.pageNumber === pageNumber)?.generatedImageUrl)
  }
  if (content.type === 'word_game') {
    const puzzleNumber = Number(key.replace('puzzle-', ''))
    return Boolean(content.wordSearches.find((ws) => ws.puzzleNumber === puzzleNumber)?.illustrationUrl)
  }
  if (content.type === 'short_story') {
    return Boolean(content.story.illustrationUrl)
  }
  if (content.type === 'novel_chapter') {
    const chapterNumber = Number(key.replace('chapter-', ''))
    return Boolean(content.novel.chapters.find((ch) => ch.chapterNumber === chapterNumber)?.illustrationUrl)
  }
  return false
}

export function pendingPrompts(content: GeneratedBookContent, styleTheme: string, regenerate?: boolean) {
  const bible = buildStyleBible(content, styleTheme)
  return collectPrompts(content, bible).filter((p) => regenerate || !hasImage(content, p.key))
}

/**
 * How many image calls a run of `illustrateProject` will actually make, so a
 * route can price and skip charging before spending, and so the UI can show
 * the total credits it will charge before the click.
 */
export function countIllustrationRequests(input: {
  content: GeneratedBookContent
  styleTheme: string
  regenerate?: boolean
  existingCoverUrl?: string | null
}): number {
  const keepCover = Boolean(input.existingCoverUrl) && !input.regenerate
  return pendingPrompts(input.content, input.styleTheme, input.regenerate).length + (keepCover ? 0 : 1)
}
