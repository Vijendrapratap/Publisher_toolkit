import { generateAiImage, type AiCredentials } from '@/lib/providers/ai'
import { storeFile } from '@/lib/providers/storage'
import { assetPath } from '@/lib/services/shared/upload'
import type { GeneratedBookContent } from './types'
import { pendingPrompts } from './illustrate-shared'
import { describeStyle } from './options'

export { buildStyleBible, countIllustrationRequests } from './illustrate-shared'

/**
 * Turns a generated book's image prompts into actual images.
 *
 * Until now `illustrationPrompt` and `lineArtPrompt` were produced and shown
 * with a "copy" button — the viewer renders `generatedImageUrl` but nothing
 * ever set it, so a "children's book" was text plus homework.
 *
 * The pure "how many / which prompts" logic lives in `illustrate-shared.ts`
 * so it can also be imported from client components (no AI/storage imports).
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
    `Style: ${describeStyle(styleTheme)}.`,
    `Subject: ${subject ?? title}.`,
    // The model cannot spell reliably at poster sizes, and the title is set in
    // the layout anyway; asking for lettering only produces garbled shapes.
    'Leave clear space at the top for a title. Do not draw any text, letters or words.',
  ].join(' ')
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
    /** Kept on a gap-filling run instead of being paid for again. */
    existingCoverUrl?: string | null
  },
  credentials?: AiCredentials
): Promise<IllustrationResult> {
  // Mutated in place by `apply`, so clone rather than editing the caller's copy.
  const content = structuredClone(input.content)
  const prompts = pendingPrompts(content, input.styleTheme, input.regenerate)

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

  // The cover goes first: it is what the dashboard, preview and PDF lead
  // with, and a long book can hit the time limit before its last page.
  const keepCover = Boolean(input.existingCoverUrl) && !input.regenerate
  let coverImageUrl: string | null = keepCover ? input.existingCoverUrl! : null
  if (!keepCover) {
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

  return {
    content,
    coverImageUrl,
    requested: prompts.length + (keepCover ? 0 : 1),
    succeeded: succeeded + (!keepCover && coverImageUrl ? 1 : 0),
    failures,
  }
}

/** How many image calls a project will make, so the UI can warn before spending. */
export function countIllustrations(content: GeneratedBookContent): number {
  if (content.type === 'children' || content.type === 'coloring') return content.pages.length + 1
  if (content.type === 'word_game') return content.wordSearches.length + 1
  if (content.type === 'short_story') return 2
  if (content.type === 'novel_chapter') return Math.min(content.novel.chapters.length, 5) + 1
  return 1
}
