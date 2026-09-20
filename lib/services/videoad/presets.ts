import { z } from 'zod'

/**
 * Amazon Sponsored Brands video ads, not movie trailers.
 *
 * The distinction drives every value in this file. These ads autoplay **muted**
 * in a ~300px carousel tile, so the text has to carry the whole message and be
 * legible at a quarter of its rendered size. The cinematic idiom the old engine
 * used — near-black gradients, light serif, a blurb set as a pull-quote — is
 * unreadable at that scale.
 */

export const AD_FORMATS = [
  {
    key: '1:1',
    label: 'Square — Amazon carousel',
    description: 'Sponsored Brands video on product pages and search results',
    width: 1080,
    height: 1080,
    // What one tile is actually rendered at on a product page. Every type size
    // in the layout is checked against this, not against the canvas.
    tilePx: 300,
  },
  {
    key: '16:9',
    label: 'Widescreen',
    description: 'YouTube, Meta feed, your book website',
    width: 1920,
    height: 1080,
    tilePx: 480,
  },
  {
    key: '9:16',
    label: 'Vertical',
    description: 'Reels, Shorts, TikTok',
    width: 1080,
    height: 1920,
    tilePx: 320,
  },
] as const
export type AdFormat = (typeof AD_FORMATS)[number]['key']

/**
 * Amazon accepts 6–45s and reports the strongest completion under ~20s.
 * The old 30s/60s defaults were built for YouTube, where nobody sees these.
 */
export const AD_LENGTHS = [
  { key: '6s', label: '6 seconds', description: 'Bumper — one claim, one cover', durationSec: 6 },
  { key: '15s', label: '15 seconds', description: 'Recommended for Amazon', durationSec: 15 },
  { key: '20s', label: '20 seconds', description: 'Room for an interior showcase', durationSec: 20 },
  { key: '30s', label: '30 seconds', description: 'Full feature walkthrough', durationSec: 30 },
] as const
export type AdLength = (typeof AD_LENGTHS)[number]['key']

export interface Palette {
  /** Two-stop background wash. */
  background: [string, string]
  /** Panel behind the headline in split layouts. */
  panel: string
  ink: string
  inkMuted: string
  accent: string
  onAccent: string
}

export interface AdPreset {
  key: string
  label: string
  description: string
  /** Which book types this is tuned for, shown in the picker. */
  bestFor: string[]
  palette: Palette
  /** Sans throughout: serif loses too much at tile size. */
  headlineWeight: number
  /** Beat plan, in order. Trimmed to fit the chosen duration. */
  beats: BeatKind[]
  /** Fallback benefit lines when the book supplies none. */
  defaultBenefits: string[]
  cta: string
  /** Prompt fragment used when AI scene backgrounds are enabled. */
  scenePrompt: string
}

export type BeatKind =
  /** Cover + the single strongest claim, split-screen. */
  | 'hook'
  /** Stacked benefit lines, one revealed at a time. */
  | 'benefits'
  /** Interior page imagery — the "look inside" beat. */
  | 'interior'
  /** Rating, review count and price as social proof. */
  | 'proof'
  /** Cover, title, author and the call to action. */
  | 'cta'

const PUZZLE_PALETTE: Palette = {
  background: ['#fde9f3', '#e9e4ff'],
  panel: '#ffffff',
  ink: '#1b1033',
  inkMuted: '#5a4a7a',
  accent: '#d6246e',
  onAccent: '#ffffff',
}

const CHILDREN_PALETTE: Palette = {
  background: ['#fff4d9', '#ffe0ec'],
  panel: '#fffdf7',
  ink: '#2a1a0f',
  inkMuted: '#6d5741',
  accent: '#f4711f',
  onAccent: '#ffffff',
}

const COLORING_PALETTE: Palette = {
  background: ['#ffffff', '#eef4ff'],
  panel: '#ffffff',
  ink: '#101828',
  inkMuted: '#475467',
  accent: '#2563eb',
  onAccent: '#ffffff',
}

const TRADE_PALETTE: Palette = {
  background: ['#f7f3ec', '#e8e2d6'],
  panel: '#ffffff',
  ink: '#1a1712',
  inkMuted: '#5c5348',
  accent: '#b4541c',
  onAccent: '#ffffff',
}

export const AD_PRESETS: AdPreset[] = [
  {
    key: 'puzzle',
    label: 'Puzzle & activity',
    description: 'Benefit-led, large-print claims and an interior page showcase.',
    bestFor: ['Word search', 'Crossword', 'Sudoku', 'Activity books'],
    palette: PUZZLE_PALETTE,
    headlineWeight: 800,
    beats: ['hook', 'benefits', 'interior', 'cta'],
    defaultBenefits: [
      'EXTRA LARGE PRINT',
      'SOLUTIONS INCLUDED',
      'HOURS OF RELAXING FUN',
    ],
    cta: 'GET YOUR COPY TODAY',
    scenePrompt:
      'bright cheerful flat-lay photograph, pastel spring colours, soft daylight, clean uncluttered surface, generous empty space on the left for text, no book, no people, no text',
  },
  {
    key: 'children',
    label: "Children's picture book",
    description: 'Warm storybook palette, character spreads and read-aloud framing.',
    bestFor: ["Children's stories", 'Bedtime books', 'Early readers'],
    palette: CHILDREN_PALETTE,
    headlineWeight: 800,
    beats: ['hook', 'interior', 'benefits', 'cta'],
    defaultBenefits: [
      'BEAUTIFULLY ILLUSTRATED',
      'PERFECT FOR BEDTIME',
      'AGES 3 TO 7',
    ],
    cta: 'READ IT TONIGHT',
    scenePrompt:
      'warm cosy nursery photograph, soft morning light, pastel wooden surface, gentle bokeh, generous empty space on the left for text, no book, no people, no text',
  },
  {
    key: 'coloring',
    label: 'Coloring book',
    description: 'Clean white studio look with a line-art page showcase.',
    bestFor: ['Coloring books', 'Line art', 'Mindfulness'],
    palette: COLORING_PALETTE,
    headlineWeight: 800,
    beats: ['hook', 'interior', 'benefits', 'cta'],
    defaultBenefits: [
      'SINGLE-SIDED PAGES',
      'NO BLEED-THROUGH',
      'BOLD, EASY-TO-COLOUR LINES',
    ],
    cta: 'START COLOURING',
    scenePrompt:
      'clean bright studio photograph, white desk, scattered colouring pencils, crisp daylight, generous empty space on the left for text, no book, no people, no text',
  },
  {
    key: 'trade',
    label: 'Novel & general trade',
    description: 'Editorial palette led by the premise and review proof.',
    bestFor: ['Fiction', 'Non-fiction', 'Memoir', 'Business'],
    palette: TRADE_PALETTE,
    headlineWeight: 700,
    beats: ['hook', 'proof', 'benefits', 'cta'],
    defaultBenefits: ['A STORY YOU WON’T PUT DOWN'],
    cta: 'ORDER YOUR COPY',
    scenePrompt:
      'elegant editorial photograph, warm linen and oak surface, soft window light, shallow depth of field, generous empty space on the left for text, no book, no people, no text',
  },
]

export function getPreset(key: string | null | undefined): AdPreset {
  return AD_PRESETS.find((p) => p.key === key) ?? AD_PRESETS[3]
}

export function getFormat(key: string | null | undefined): (typeof AD_FORMATS)[number] {
  return AD_FORMATS.find((f) => f.key === key) ?? AD_FORMATS[0]
}

export function getDuration(key: string | null | undefined): number {
  return AD_LENGTHS.find((l) => l.key === key)?.durationSec ?? 15
}

/**
 * Amazon's bestseller categories are the most reliable genre signal we get,
 * so the preset is inferred rather than asked for when a listing was imported.
 */
export function inferPreset(input: {
  bookType?: string | null
  categories?: string[] | null
  title?: string | null
}): AdPreset {
  const byBookType: Record<string, string> = {
    children: 'children',
    coloring: 'coloring',
    word_game: 'puzzle',
    novel_chapter: 'trade',
    short_story: 'trade',
  }
  const mapped = input.bookType ? byBookType[input.bookType] : undefined
  if (mapped) return getPreset(mapped)

  const haystack = [...(input.categories ?? []), input.title ?? ''].join(' ').toLowerCase()
  if (/word search|crossword|sudoku|puzzle|activity book|brain game/.test(haystack)) return getPreset('puzzle')
  if (/colou?ring/.test(haystack)) return getPreset('coloring')
  if (/children|picture book|bedtime|toddler|early reader|ages \d/.test(haystack)) return getPreset('children')
  return getPreset('trade')
}

export const videoAdConfigSchema = z.object({
  preset: z.enum(['puzzle', 'children', 'coloring', 'trade']),
  format: z.enum(['1:1', '16:9', '9:16']),
  length: z.enum(['6s', '15s', '20s', '30s']),
  headline: z.string().trim().max(70).optional(),
  benefits: z.array(z.string().trim().min(1).max(40)).max(4).optional(),
  ctaText: z.string().trim().max(40).optional(),
  /** Generate a photoreal scene with the image model instead of the template wash. */
  aiScene: z.boolean().optional(),
  /** Burn the price and rating into the proof beat. */
  showProof: z.boolean().optional(),
})
export type VideoAdConfig = z.infer<typeof videoAdConfigSchema>
