import { z } from 'zod'

export const LENGTH_OPTIONS = [
  { key: '6s', label: '6 seconds', description: 'Bumper — one claim, one cover', durationSec: 6 },
  { key: '15s', label: '15 seconds', description: 'Recommended for Amazon', durationSec: 15 },
  { key: '20s', label: '20 seconds', description: 'Room for an interior showcase', durationSec: 20 },
  { key: '30s', label: '30 seconds', description: 'Full feature walkthrough', durationSec: 30 },
] as const
export type TrailerLength = (typeof LENGTH_OPTIONS)[number]['key']

export const STYLE_OPTIONS = [
  {
    key: 'fantasy',
    label: 'Epic Fantasy',
    tagline: 'Ancient Storybook',
    description: 'Aged parchment, floating golden embers, glowing runes & mystical lore',
    bestFor: ['Fantasy', 'Mythology', 'Historical Fiction', 'Fairy Tales'],
    palette: { background: '#1c1008', surface: '#2e1b10', accent: '#f59e0b', ink: '#fef08a' },
  },
  {
    key: 'thriller',
    label: 'Dark Thriller',
    tagline: 'Noir Suspense',
    description: 'Gritty noir textures, crimson hazard accents, high tension & mystery',
    bestFor: ['Thriller', 'Crime', 'Mystery', 'Psychological Horror'],
    palette: { background: '#0a0507', surface: '#1c080e', accent: '#ef4444', ink: '#ffffff' },
  },
  {
    key: 'scifi',
    label: 'Sci-Fi Cyber',
    tagline: 'Cosmic Hologram',
    description: 'Deep space void, cyan holographic HUD, digital scanlines & neon grid',
    bestFor: ['Science Fiction', 'Cyberpunk', 'Dystopian', 'Space Opera'],
    palette: { background: '#050a18', surface: '#0c1630', accent: '#06b6d4', ink: '#e0f2fe' },
  },
  {
    key: 'romance',
    label: 'Romance & Poetry',
    tagline: 'Warm Elegance',
    description: 'Rose gold hues, soft bokeh light leaks, warm editorial charm',
    bestFor: ['Romance', 'Poetry', 'Literary Memoir', 'Drama'],
    palette: { background: '#190a12', surface: '#2b1220', accent: '#fb7185', ink: '#ffe4e6' },
  },
  {
    key: 'cinematic',
    label: 'Classic Film',
    tagline: 'Bestseller Cinematic',
    description: 'Timeless filmic grading, warm studio spotlight, luxury gold leaf',
    bestFor: ['Bestseller Fiction', 'Biographies', 'Prestige Drama'],
    palette: { background: '#0c0a09', surface: '#1c1917', accent: '#d97706', ink: '#f8fafc' },
  },
  {
    key: 'minimal',
    label: 'Modern Editorial',
    tagline: 'Quiet Precision',
    description: 'Clean architectural layout, platinum tones, quiet confident space',
    bestFor: ['Non-Fiction', 'Philosophy', 'Business', 'Essays'],
    palette: { background: '#0f172a', surface: '#1e293b', accent: '#38bdf8', ink: '#f8fafc' },
  },
  {
    key: 'dramatic',
    label: 'Blockbuster',
    tagline: 'High Impact',
    description: 'Intense contrast, bold scarlet energy, thunderous urgency',
    bestFor: ['Action', 'War / Military', 'Dark Fantasy'],
    palette: { background: '#120408', surface: '#240810', accent: '#f43f5e', ink: '#ffffff' },
  },
  {
    key: 'energetic',
    label: 'Vibrant Dynamic',
    tagline: 'Pop Momentum',
    description: 'Electric ultraviolet, fast-paced momentum, modern pop styling',
    bestFor: ['Young Adult', 'Contemporary', 'Graphic Novels', 'Urban Fantasy'],
    palette: { background: '#15092a', surface: '#2d1355', accent: '#c084fc', ink: '#ffffff' },
  },
] as const
export type TrailerStyle = (typeof STYLE_OPTIONS)[number]['key']

export function getStyleSpec(key: string): (typeof STYLE_OPTIONS)[number] {
  return STYLE_OPTIONS.find((s) => s.key === key) ?? STYLE_OPTIONS[0]
}

export const MUSIC_MOOD_OPTIONS = [
  { key: 'suspenseful', label: 'Suspenseful', description: 'Deep bass, tense rhythm, mysterious ambiance' },
  { key: 'epic', label: 'Epic', description: 'Rising orchestral swell, brass, impactful drums' },
  { key: 'ambient', label: 'Ambient', description: 'Ethereal pads, acoustic gentle warmth, reflective' },
  { key: 'upbeat', label: 'Upbeat', description: 'Modern pulse, positive momentum, crisp synths' },
  { key: 'emotional', label: 'Emotional', description: 'Melodic piano, strings, moving character focus' },
] as const
export type TrailerMusicMood = (typeof MUSIC_MOOD_OPTIONS)[number]['key']

export const ASPECT_RATIO_OPTIONS = [
  { key: '9:16', label: 'Vertical (9:16)', description: 'TikTok, Instagram Reels, YouTube Shorts', width: 1080, height: 1920 },
  { key: '1:1', label: 'Square (1:1)', description: 'Instagram Feed, Facebook & LinkedIn posts', width: 1080, height: 1080 },
  { key: '16:9', label: 'Widescreen (16:9)', description: 'YouTube, Book Website, Landscape displays', width: 1920, height: 1080 },
] as const
export type TrailerAspectRatio = (typeof ASPECT_RATIO_OPTIONS)[number]['key']

export function getAspectRatioSpec(key: string): (typeof ASPECT_RATIO_OPTIONS)[number] {
  return ASPECT_RATIO_OPTIONS.find((a) => a.key === key) ?? ASPECT_RATIO_OPTIONS[0]
}

export function getDurationForLength(key: string): number {
  return LENGTH_OPTIONS.find((l) => l.key === key)?.durationSec ?? 30
}

export type TrailerProjectStatus = 'uploaded' | 'configured' | 'generated'

export const trailerProjectUpdateSchema = z
  .object({
    title: z.string().trim().max(200),
    author: z.string().trim().max(200),
    blurb: z.string().trim().max(2000),
    length: z.enum(['6s', '15s', '20s', '30s']),
    style: z.enum([
      'fantasy',
      'thriller',
      'scifi',
      'romance',
      'cinematic',
      'minimal',
      'dramatic',
      'energetic',
    ]),
    musicMood: z.enum(['suspenseful', 'epic', 'ambient', 'upbeat', 'emotional']),
    aspectRatios: z
      .array(z.enum(['9:16', '1:1', '16:9']))
      .min(1, 'Select at least one aspect ratio')
      .transform((a) => [...new Set(a)]),
    hookText: z.string().trim().max(300).nullable().optional(),
    ctaText: z.string().trim().max(200).nullable().optional(),
    // Video-ad configuration. The cinematic style/mood fields above are kept
    // for existing projects; new ads are driven by the preset and the script.
    adPreset: z.enum(['puzzle', 'children', 'coloring', 'trade']),
    adHeadline: z.string().trim().max(70).nullable().optional(),
    adBenefits: z.array(z.string().trim().min(1).max(40)).max(4),
    aiScene: z.boolean(),
    showProof: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')

/**
 * Database columns are plain strings, so every value read back has to be
 * narrowed before it reaches the renderer. These coercions keep the `as any`
 * casts out of the call sites and make an unknown stored value fall back to a
 * working default instead of reaching canvas code that expects a union member.
 */
function coerce<T extends string>(options: readonly { key: T }[], value: string | null | undefined, fallback: T): T {
  return options.some((o) => o.key === value) ? (value as T) : fallback
}

export const toTrailerLength = (v?: string | null, fallback: TrailerLength = '15s') =>
  coerce(LENGTH_OPTIONS, v, fallback)

export const toTrailerStyle = (v?: string | null, fallback: TrailerStyle = 'cinematic') =>
  coerce(STYLE_OPTIONS, v, fallback)

export const toTrailerMusicMood = (v?: string | null, fallback: TrailerMusicMood = 'suspenseful') =>
  coerce(MUSIC_MOOD_OPTIONS, v, fallback)

export const toTrailerAspectRatio = (v?: string | null, fallback: TrailerAspectRatio = '16:9') =>
  coerce(ASPECT_RATIO_OPTIONS, v, fallback)
