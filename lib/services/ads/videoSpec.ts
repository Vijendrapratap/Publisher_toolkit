import { z } from 'zod'
import {
  STYLE_OPTIONS,
  getAspectRatioSpec,
  getDurationForLength,
  getStyleSpec,
  toTrailerAspectRatio,
  toTrailerLength,
  toTrailerMusicMood,
  toTrailerStyle,
  type TrailerStyle,
} from '@/lib/services/trailer/options'

/** Fonts offered in the video editor; each has a loader in the composition's fonts.ts. */
export const AD_FONTS = [
  { key: 'inter', label: 'Inter' },
  { key: 'montserrat', label: 'Montserrat' },
  { key: 'bebas', label: 'Bebas Neue' },
  { key: 'playfair', label: 'Playfair Display' },
  { key: 'lora', label: 'Lora' },
  { key: 'cinzel', label: 'Cinzel' },
  { key: 'merriweather', label: 'Merriweather' },
  { key: 'caveat', label: 'Caveat' },
] as const
export type AdFontKey = (typeof AD_FONTS)[number]['key']

/** Sized so every line fits the frame at every format without shrinking past legibility. */
export const SCRIPT_LIMITS = { hook: 60, storyLine: 140, benefit: 28, benefits: 4, cta: 28 } as const
export const FPS = 30

const FONT_KEYS = AD_FONTS.map((f) => f.key) as [AdFontKey, ...AdFontKey[]]
const STYLE_KEYS = STYLE_OPTIONS.map((s) => s.key) as [TrailerStyle, ...TrailerStyle[]]
const hex = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a colour like #1a2b3c')

/** Bundled public-domain/CC0 tracks, one per mood; credits in public/music/CREDITS.md. */
export const MUSIC_TRACKS = [
  { key: 'suspenseful', label: 'In the Hall of the Mountain King', composer: 'Grieg' },
  { key: 'epic', label: 'Ride of the Valkyries', composer: 'Wagner' },
  { key: 'ambient', label: 'Gymnopédie No. 1', composer: 'Satie' },
  { key: 'upbeat', label: 'The Entertainer', composer: 'Joplin' },
  { key: 'emotional', label: 'Gymnopédie No. 2', composer: 'Satie' },
] as const
export type MusicTrackKey = (typeof MUSIC_TRACKS)[number]['key']
const TRACK_KEYS = MUSIC_TRACKS.map((t) => t.key) as [MusicTrackKey, ...MusicTrackKey[]]

export const musicSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('library'), track: z.enum(TRACK_KEYS) }),
  // Only our own stored files: the URL is later fetched on the server.
  z.object({ kind: z.literal('upload'), url: z.string().startsWith('/api/files/'), name: z.string().trim().min(1).max(120) }),
])

export const adVideoSpecSchema = z.object({
  script: z.object({
    hook: z.string().trim().min(1, 'Add a hook').max(SCRIPT_LIMITS.hook, `Keep the hook under ${SCRIPT_LIMITS.hook} characters`),
    storyLine: z.string().trim().max(SCRIPT_LIMITS.storyLine, `Keep the story line under ${SCRIPT_LIMITS.storyLine} characters`),
    benefits: z
      .array(z.string().trim().min(1, 'Remove empty benefits').max(SCRIPT_LIMITS.benefit, `Keep each benefit under ${SCRIPT_LIMITS.benefit} characters`))
      .max(SCRIPT_LIMITS.benefits, `Use at most ${SCRIPT_LIMITS.benefits} benefits`),
    cta: z.string().trim().min(1, 'Add a call to action').max(SCRIPT_LIMITS.cta, `Keep the call to action under ${SCRIPT_LIMITS.cta} characters`),
  }),
  style: z.object({
    preset: z.enum(STYLE_KEYS),
    font: z.enum(FONT_KEYS),
    colors: z.object({ bgFrom: hex, bgTo: hex, accent: hex, text: hex }),
  }),
  format: z.enum(['9:16', '1:1', '16:9']),
  length: z.enum(['6s', '15s', '20s', '30s']),
  mood: z.enum(['suspenseful', 'epic', 'ambient', 'upbeat', 'emotional']),
  // Optional so specs saved before music existed still validate.
  music: musicSchema.optional(),
})
export type AdVideoSpec = z.infer<typeof adVideoSpecSchema>

const PRESET_FONTS: Record<TrailerStyle, AdFontKey> = {
  fantasy: 'cinzel',
  thriller: 'bebas',
  scifi: 'montserrat',
  romance: 'playfair',
  cinematic: 'playfair',
  minimal: 'inter',
  dramatic: 'bebas',
  energetic: 'montserrat',
}

/** The font and colours a preset starts from; the publisher can change any of them. */
export function presetStyle(preset: TrailerStyle): AdVideoSpec['style'] {
  const { palette } = getStyleSpec(preset)
  return {
    preset,
    font: PRESET_FONTS[preset],
    colors: { bgFrom: palette.surface, bgTo: palette.background, accent: palette.accent, text: palette.ink },
  }
}

/** Cuts at a word boundary so an automatic default never ends mid-word. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const head = clean.slice(0, max + 1)
  const lastSpace = head.lastIndexOf(' ')
  const cut = lastSpace > max * 0.5 ? head.slice(0, lastSpace) : clean.slice(0, max)
  return cut.replace(/[\s,;:•–—-]+$/, '')
}

export interface VideoSpecSource {
  title?: string | null
  blurb?: string | null
  hook?: string | null
  cta?: string | null
  style?: string | null
  format?: string | null
  length?: string | null
  mood?: string | null
}

/** A spec built only from what the publisher already entered — no AI call. */
export function defaultVideoSpec(source: VideoSpecSource): AdVideoSpec {
  const opening = (source.blurb ?? '').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
  return {
    script: {
      hook: clip(source.hook || source.title || 'A story you will not forget', SCRIPT_LIMITS.hook),
      storyLine: clip(opening, SCRIPT_LIMITS.storyLine),
      benefits: [],
      cta: clip(source.cta || 'Get your copy today', SCRIPT_LIMITS.cta),
    },
    style: presetStyle(toTrailerStyle(source.style)),
    format: toTrailerAspectRatio(source.format, '16:9'),
    length: toTrailerLength(source.length, '15s'),
    mood: toTrailerMusicMood(source.mood),
  }
}

/** The saved spec, or the default when none was saved or it no longer validates. */
export function readVideoSpec(stored: unknown, source: VideoSpecSource): AdVideoSpec {
  const parsed = adVideoSpecSchema.safeParse(stored)
  return parsed.success ? parsed.data : defaultVideoSpec(source)
}

/** The saved music choice, or the bundled track that matches the mood. */
export function resolveMusic(spec: Pick<AdVideoSpec, 'music' | 'mood'>): NonNullable<AdVideoSpec['music']> {
  return spec.music ?? { kind: 'library', track: spec.mood }
}

export function musicUrl(music: NonNullable<AdVideoSpec['music']>): string | null {
  if (music.kind === 'none') return null
  return music.kind === 'library' ? `/music/${music.track}.mp3` : music.url
}

export function bookVideoSource(book: {
  title: string | null
  blurb: string | null
  customHook: string | null
  ctaText: string | null
  videoStyle: string | null
  videoFormat: string | null
  videoLength: string | null
  videoMood: string | null
}): VideoSpecSource {
  return {
    title: book.title,
    blurb: book.blurb,
    hook: book.customHook,
    cta: book.ctaText,
    style: book.videoStyle,
    format: book.videoFormat,
    length: book.videoLength,
    mood: book.videoMood,
  }
}

export function videoDimensions(format: AdVideoSpec['format']): { width: number; height: number } {
  const { width, height } = getAspectRatioSpec(format)
  return { width, height }
}

export function videoDurationInFrames(spec: Pick<AdVideoSpec, 'length'>): number {
  return getDurationForLength(spec.length) * FPS
}
