import { z } from 'zod'
import type { BookTypeKey } from './options'

/**
 * One schema per book type, rather than one union.
 *
 * The user has already chosen what they are making, so the model is never asked
 * to pick a shape — it cannot answer a coloring-book request with story pages,
 * and a response that drifts fails validation instead of being persisted.
 * Every `describe()` here is also instruction the provider sees.
 */

const storyPageSchema = z.object({
  pageNumber: z.number().int().min(1),
  spreadHeading: z.string().max(80).describe('Short title for this two-page spread'),
  storyText: z
    .string()
    .min(1)
    .max(700)
    .describe('The text printed on this spread. 2-5 sentences a child can follow when read aloud.'),
  rhymePattern: z.string().max(60).optional(),
  characterFocus: z.string().max(120).optional().describe('Who this spread is about'),
  illustrationPrompt: z
    .string()
    .min(1)
    .max(600)
    .describe(
      'A self-contained image prompt. Restate the character by full description every time — the illustrator has no memory of other pages.'
    ),
})

const coloringPageSchema = z.object({
  pageNumber: z.number().int().min(1),
  title: z.string().min(1).max(80),
  sceneDescription: z.string().min(1).max(400),
  lineArtPrompt: z
    .string()
    .min(1)
    .max(600)
    .describe('Must ask for pure black outlines on white, no shading, no gray fill, no background texture'),
  detailLevel: z.enum(['simple', 'moderate', 'intricate']),
})

/**
 * Models cannot reliably lay words into a letter matrix, so they supply only
 * the word list and the grid is built deterministically from it.
 */
const wordSearchDraftSchema = z.object({
  puzzleNumber: z.number().int().min(1),
  title: z.string().min(1).max(80),
  theme: z.string().min(1).max(80),
  gridSize: z.number().int().min(8).max(20).default(12),
  words: z
    .array(z.string().min(3).max(12).describe('Letters only, no spaces or punctuation'))
    .min(5)
    .max(14),
  hiddenFact: z.string().max(200).optional().describe('A true, checkable fact about the theme'),
  illustrationPrompt: z.string().max(600).optional().describe('Illustration prompt for the puzzle theme artwork'),
})

const crosswordSchema = z.object({
  puzzleNumber: z.number().int().min(1),
  title: z.string().min(1).max(80),
  across: z
    .array(
      z.object({
        num: z.number().int().min(1),
        clue: z.string().min(1).max(160),
        answer: z.string().min(2).max(14).describe('Letters only, uppercase'),
      })
    )
    .min(2),
  down: z
    .array(
      z.object({
        num: z.number().int().min(1),
        clue: z.string().min(1).max(160),
        answer: z.string().min(2).max(14).describe('Letters only, uppercase'),
      })
    )
    .min(2),
})

const chapterOutlineSchema = z.object({
  chapterNumber: z.number().int().min(1),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500).describe('What actually happens, not a teaser'),
  sceneGoal: z.string().max(300).optional().describe('What changes by the end of the chapter'),
  setting: z.string().max(160).optional(),
  characters: z.array(z.string().max(80)).max(8).optional(),
})

export const childrenContentSchema = z.object({
  type: z.literal('children'),
  pages: z.array(storyPageSchema).min(1).max(40),
})

export const coloringContentSchema = z.object({
  type: z.literal('coloring'),
  pages: z.array(coloringPageSchema).min(1).max(60),
})

export const wordGameContentSchema = z.object({
  type: z.literal('word_game'),
  wordSearches: z.array(wordSearchDraftSchema).min(1).max(20),
  crosswords: z.array(crosswordSchema).max(20).optional(),
})

export const novelContentSchema = z.object({
  type: z.literal('novel_chapter'),
  novel: z.object({
    premise: z.string().min(1).max(1200),
    logline: z.string().min(1).max(300).describe('One sentence: protagonist, want, obstacle, stakes'),
    protagonist: z.string().min(1).max(200),
    antagonistOrConflict: z.string().min(1).max(300),
    targetWordCount: z.number().int().min(5_000).max(200_000).optional(),
    chapters: z.array(chapterOutlineSchema).min(1).max(60),
  }),
})

export const shortStoryContentSchema = z.object({
  type: z.literal('short_story'),
  story: z.object({
    title: z.string().min(1).max(160),
    synopsis: z.string().min(1).max(800),
    theme: z.string().min(1).max(200),
    storyText: z.string().min(1).describe('The complete story, paragraphs separated by blank lines'),
    illustrationPrompt: z.string().max(600).optional().describe('Illustration prompt for the key story scene artwork'),
  }),
})

export const CONTENT_SCHEMAS = {
  children: childrenContentSchema,
  coloring: coloringContentSchema,
  word_game: wordGameContentSchema,
  novel_chapter: novelContentSchema,
  short_story: shortStoryContentSchema,
} satisfies Record<BookTypeKey, z.ZodType>

export type ChildrenDraft = z.infer<typeof childrenContentSchema>
export type ColoringDraft = z.infer<typeof coloringContentSchema>
export type WordGameDraft = z.infer<typeof wordGameContentSchema>
export type NovelDraft = z.infer<typeof novelContentSchema>
export type ShortStoryDraft = z.infer<typeof shortStoryContentSchema>

export const chapterProseSchema = z.object({
  content: z
    .string()
    .min(1)
    .describe('The chapter prose only — no chapter number, no title, no notes to the author'),
})

/** Union of every draft shape, for narrowing after a per-type generation. */
export type BookContentDraft =
  | ChildrenDraft
  | ColoringDraft
  | WordGameDraft
  | NovelDraft
  | ShortStoryDraft
