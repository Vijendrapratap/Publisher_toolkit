import { generateAiImage, type AiCredentials } from '@/lib/providers/ai'
import { storeFile } from '@/lib/providers/storage'
import { assetPath } from '@/lib/services/shared/upload'
import type { GeneratedBookContent } from './types'

/**
 * Turns a generated book's image prompts into actual images.
 *
 * Until now `illustrationPrompt` and `lineArtPrompt` were produced and shown
 * with a "copy" button — the viewer renders `generatedImageUrl` but nothing
 * ever set it, so a "children's book" was text plus homework.
 */

/** Bounded so a 40-page coloring book does not fan out into a rate limit. */
const CONCURRENCY = 3
const ATTEMPTS_PER_IMAGE = 2

export interface IllustrationResult {
  content: GeneratedBookContent
  coverImageUrl: string | null
  requested: number
  succeeded: number
  /** One message per distinct failure, for reporting rather than logging. */
  failures: string[]
}

/**
 * Each page is drawn by a separate, memoryless model call, so a character
 * described only on page one comes back as a different animal on page four.
 * Restating a locked description in every prompt is what holds a book together.
 */
export function buildStyleBible(content: GeneratedBookContent, styleTheme: string): string {
  const parts = [`Consistent art style throughout: ${styleTheme}.`]

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

function coverPromptFor(
  content: GeneratedBookContent,
  title: string,
  styleTheme: string
): string {
  const subject =
    content.type === 'children'
      ? content.pages[0]?.illustrationPrompt
      : content.type === 'coloring'
        ? content.pages[0]?.sceneDescription
        : content.type === 'novel_chapter'
          ? content.novel.logline
          : content.type === 'short_story'
            ? content.story.theme
            : 'a puzzle book cover'

  return [
    `Front cover artwork for a book called "${title}".`,
    `Style: ${styleTheme}.`,
    `Subject: ${subject ?? title}.`,
    // The model cannot spell reliably at poster sizes, and the title is set in
    // the layout anyway; asking for lettering only produces garbled shapes.
    'Leave clear space at the top for a title. Do not draw any text, letters or words.',
  ].join(' ')
}

/** Every prompt this project needs, paired with where the result belongs. */
function collectPrompts(
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

async function generateWithRetry(prompt: string, credentials?: AiCredentials) {
  for (let attempt = 1; attempt <= ATTEMPTS_PER_IMAGE; attempt++) {
    const image = await generateAiImage(prompt, { credentials, timeoutMs: 90_000 })
    if (image) return image
  }
  return null
}

export async function illustrateProject(
  input: {
    projectId: string
    publisherId: string
    title: string
    styleTheme: string
    content: GeneratedBookContent
    /** Skip pages that already have art, so a retry only fills the gaps. */
    regenerate?: boolean
  },
  credentials?: AiCredentials
): Promise<IllustrationResult> {
  // Mutated in place by `apply`, so clone rather than editing the caller's copy.
  const content = structuredClone(input.content)
  const bible = buildStyleBible(content, input.styleTheme)

  const prompts = collectPrompts(content, bible).filter((p) => {
    if (input.regenerate) return true
    return !hasImage(content, p.key)
  })

  const failures: string[] = []
  let succeeded = 0

  const store = async (key: string, buffer: Buffer, contentType: string) => {
    const { url } = await storeFile(
      assetPath(`creator/${input.projectId}`, input.publisherId, key, contentType),
      buffer,
      contentType
    )
    return url
  }

  for (let i = 0; i < prompts.length; i += CONCURRENCY) {
    const batch = prompts.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (item) => {
        try {
          const image = await generateWithRetry(item.prompt, credentials)
          if (!image) {
            failures.push(`${item.key}: the image model returned nothing`)
            return
          }
          item.apply(await store(item.key, image.buffer, image.contentType))
          succeeded++
        } catch (err) {
          failures.push(`${item.key}: ${err instanceof Error ? err.message : 'failed'}`)
        }
      })
    )
  }

  // The cover is worth its own attempt even when pages failed.
  let coverImageUrl: string | null = null
  try {
    const cover = await generateWithRetry(
      coverPromptFor(content, input.title, input.styleTheme),
      credentials
    )
    if (cover) coverImageUrl = await store('cover', cover.buffer, cover.contentType)
    else failures.push('cover: the image model returned nothing')
  } catch (err) {
    failures.push(`cover: ${err instanceof Error ? err.message : 'failed'}`)
  }

  return {
    content,
    coverImageUrl,
    requested: prompts.length + 1,
    succeeded: succeeded + (coverImageUrl ? 1 : 0),
    failures,
  }
}

function hasImage(content: GeneratedBookContent, key: string): boolean {
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

/** How many image calls a project will make, so the UI can warn before spending. */
export function countIllustrations(content: GeneratedBookContent): number {
  if (content.type === 'children' || content.type === 'coloring') return content.pages.length + 1
  if (content.type === 'word_game') return content.wordSearches.length + 1
  if (content.type === 'short_story') return 2
  if (content.type === 'novel_chapter') return Math.min(content.novel.chapters.length, 5) + 1
  return 1
}
