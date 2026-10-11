import { z } from 'zod'
import { AD_FONTS, FPS, clip, type AdFontKey } from './videoBasics'
import { getDurationForLength, type TrailerStyle } from '@/lib/services/trailer/options'
import type { AdVideoSpec } from './videoSpec'

// One beat is one scene; the director writes them, sanitizeStoryboard enforces the rules.

export const BEAT_KINDS = ['hook', 'titleCard', 'pageZoom', 'bookOpen', 'proof', 'audience', 'endCard'] as const
export type BeatKind = (typeof BEAT_KINDS)[number]
export const PARTICLES = ['leaves', 'snow', 'dust', 'embers', 'none'] as const
export type Particle = (typeof PARTICLES)[number]

export const STORYBOARD_LIMITS = {
  text: 60,
  wordsPerLine: 7,
  beatsMin: 2,
  beatsMax: 9,
  pages: 6,
  title: 70,
  subtitle: 60,
  cta: 28,
  settingPrompt: 400,
  minSeconds: 2,
  maxSeconds: 4,
  endMinSeconds: 3,
} as const
export const TRANSITION_FRAMES = 12

const L = STORYBOARD_LIMITS
const HEX = /^#[0-9a-f]{6}$/i
const FONT_KEYS = AD_FONTS.map((f) => f.key) as [AdFontKey, ...AdFontKey[]]
const words = (line: string) => line.trim().split(/\s+/).filter(Boolean)
const fitsLines = (text: string) => {
  const lines = text.split('\n')
  return lines.length <= 2 && lines.every((l) => words(l).length <= L.wordsPerLine)
}

const line = z
  .string()
  .trim()
  .min(1, 'Add some words')
  .max(L.text, `Keep it under ${L.text} characters`)
  .refine(fitsLines, `Use at most 2 lines of ${L.wordsPerLine} words`)
const seconds = z.number().min(L.minSeconds).max(L.maxSeconds)
const page = z.number().int().min(1).max(L.pages)

export const beatSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hook'), text: line, side: z.enum(['left', 'right']), seconds }),
  z.object({ kind: z.literal('titleCard'), text: line, seconds }),
  z.object({
    kind: z.literal('pageZoom'),
    text: line.optional(),
    page,
    focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), zoom: z.number().min(1).max(3) }),
    seconds,
  }),
  z.object({ kind: z.literal('bookOpen'), text: line.optional(), page, seconds }),
  z.object({ kind: z.literal('proof'), text: line, page: page.optional(), seconds }),
  z.object({ kind: z.literal('audience'), text: line, seconds }),
  z.object({
    kind: z.literal('endCard'),
    title: z.string().trim().min(1).max(L.title),
    subtitle: z.string().trim().max(L.subtitle).optional(),
    cta: z.string().trim().min(1, 'Add a call to action').max(L.cta),
    seconds: z.number().min(L.endMinSeconds).max(L.maxSeconds),
  }),
])
export type Beat = z.infer<typeof beatSchema>
export type BeatOf<K extends BeatKind> = Extract<Beat, { kind: K }>

export const themeSchema = z.object({
  settingPrompt: z.string().trim().max(L.settingPrompt),
  settingImageUrl: z.string().nullable(),
  palette: z.object({ bg: z.string().regex(HEX), ink: z.string().regex(HEX), accent: z.string().regex(HEX) }),
  font: z.enum(FONT_KEYS),
  particles: z.enum(PARTICLES),
  cornerCover: z.boolean(),
})
export type StoryboardTheme = z.infer<typeof themeSchema>

export const storyboardSchema = z
  .object({ theme: themeSchema, beats: z.array(beatSchema).min(L.beatsMin).max(L.beatsMax) })
  .refine((sb) => sb.beats.at(-1)?.kind === 'endCard', 'The last scene must be the end card')
export type Storyboard = z.infer<typeof storyboardSchema>

/** What the model is asked for: flat and forgiving, so a small slip is repaired, not rejected. */
export const storyboardDraftSchema = z.object({
  theme: z.object({
    settingPrompt: z.string(),
    palette: z.object({ bg: z.string(), ink: z.string(), accent: z.string() }),
    font: z.string(),
    particles: z.string(),
    cornerCover: z.boolean(),
  }),
  beats: z.array(
    z.object({
      kind: z.enum(BEAT_KINDS),
      text: z.string().optional(),
      side: z.enum(['left', 'right']).optional(),
      page: z.number().optional(),
      focus: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      cta: z.string().optional(),
      seconds: z.number(),
    })
  ),
})
export type StoryboardDraft = z.infer<typeof storyboardDraftSchema>
type DraftBeat = StoryboardDraft['beats'][number]

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo))
const tenths = (n: number) => Math.round(n * 10) / 10

/** At most 2 lines of at most 7 words and 60 characters; rewraps rather than rejects. */
export function tidyLine(text: string): string {
  const clean = text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
  if (clean.length <= L.text && fitsLines(clean)) return clean
  let w = words(clean.replace(/\n/g, ' ')).slice(0, L.wordsPerLine * 2)
  const wrap = (ws: string[]) => {
    if (ws.length <= L.wordsPerLine) return ws.join(' ')
    const half = Math.ceil(ws.length / 2)
    return `${ws.slice(0, half).join(' ')}\n${ws.slice(half).join(' ')}`
  }
  while (w.length > 1 && wrap(w).length > L.text) w = w.slice(0, -1)
  return wrap(w).slice(0, L.text)
}

const PRESET_PARTICLES: Record<TrailerStyle, Particle> = {
  fantasy: 'embers',
  thriller: 'dust',
  scifi: 'dust',
  romance: 'dust',
  cinematic: 'dust',
  minimal: 'none',
  dramatic: 'dust',
  energetic: 'none',
}

function fixedTheme(style: AdVideoSpec['style']): StoryboardTheme {
  return {
    settingPrompt: '',
    settingImageUrl: null,
    palette: { bg: style.colors.bgTo, ink: style.colors.text, accent: style.colors.accent },
    font: style.font,
    particles: PRESET_PARTICLES[style.preset],
    cornerCover: false,
  }
}

const hookBeat = (text: string): Beat => ({ kind: 'hook', text: tidyLine(text) || 'A book worth reading', side: 'left', seconds: 3 })
const endCardBeat = (title: string, cta: string): Beat => ({
  kind: 'endCard',
  title: clip(title, L.title) || 'Your book',
  cta: clip(cta, L.cta) || 'Get your copy',
  seconds: 3.5,
})

function toBeat(d: DraftBeat, pageCount: number): Beat | null {
  const secs = tenths(clamp(d.seconds, L.minSeconds, L.maxSeconds))
  const text = d.text ? tidyLine(d.text) : ''
  const pages = Math.min(pageCount, L.pages)
  const okPage = (p?: number): p is number => p !== undefined && Number.isInteger(p) && p >= 1 && p <= pages
  switch (d.kind) {
    case 'hook':
      return text ? { kind: 'hook', text, side: d.side ?? 'left', seconds: secs } : null
    case 'titleCard':
      return text ? { kind: 'titleCard', text, seconds: secs } : null
    case 'audience':
      return text ? { kind: 'audience', text, seconds: secs } : null
    case 'proof':
      return text ? { kind: 'proof', text, ...(okPage(d.page) ? { page: d.page } : {}), seconds: secs } : null
    case 'pageZoom':
      if (!okPage(d.page)) return null
      return {
        kind: 'pageZoom',
        ...(text ? { text } : {}),
        page: d.page,
        focus: { x: clamp(d.focus?.x ?? 0.5, 0, 1), y: clamp(d.focus?.y ?? 0.4, 0, 1), zoom: clamp(d.focus?.zoom ?? 1.6, 1, 3) },
        seconds: secs,
      }
    case 'bookOpen':
      return okPage(d.page) ? { kind: 'bookOpen', ...(text ? { text } : {}), page: d.page, seconds: secs } : null
    case 'endCard': {
      const title = clip(d.title ?? '', L.title)
      const cta = clip(d.cta ?? '', L.cta)
      if (!title || !cta) return null
      const subtitle = d.subtitle ? clip(d.subtitle, L.subtitle) : ''
      return { kind: 'endCard', title, ...(subtitle ? { subtitle } : {}), cta, seconds: tenths(clamp(d.seconds, L.endMinSeconds, L.maxSeconds)) }
    }
  }
}

export interface StoryboardContext {
  pageCount: number
  title: string
  cta: string
  lengthSec: number
  style: AdVideoSpec['style']
}

/** Repairs whatever the model returned into a storyboard that always renders. */
export function sanitizeStoryboard(draft: StoryboardDraft, ctx: StoryboardContext): Storyboard {
  const base = fixedTheme(ctx.style)
  const pal = draft.theme.palette
  const theme: StoryboardTheme = {
    settingPrompt: (draft.theme.settingPrompt ?? '').trim().slice(0, L.settingPrompt),
    settingImageUrl: null, // set by the caller, which owns drawing and storage
    palette: {
      bg: HEX.test(pal.bg) ? pal.bg : base.palette.bg,
      ink: HEX.test(pal.ink) ? pal.ink : base.palette.ink,
      accent: HEX.test(pal.accent) ? pal.accent : base.palette.accent,
    },
    font: (FONT_KEYS as readonly string[]).includes(draft.theme.font) ? (draft.theme.font as AdFontKey) : base.font,
    particles: (PARTICLES as readonly string[]).includes(draft.theme.particles) ? (draft.theme.particles as Particle) : 'none',
    cornerCover: Boolean(draft.theme.cornerCover),
  }
  const beats = draft.beats.map((b) => toBeat(b, ctx.pageCount)).filter((b): b is Beat => b !== null)
  const end = [...beats].reverse().find((b) => b.kind === 'endCard') ?? endCardBeat(ctx.title, ctx.cta)
  let body: Beat[] = beats.filter((b) => b.kind !== 'endCard')
  if (body[0]?.kind !== 'hook' && body[0]?.kind !== 'titleCard') body = [hookBeat(ctx.title), ...body]
  body = body.slice(0, L.beatsMax - 1)
  return { theme, beats: fitToLength([...body, end], ctx.lengthSec) }
}

export const beatFrames = (beat: Beat) => Math.round(beat.seconds * FPS)

export function storyboardDurationInFrames(beats: Beat[]): number {
  return beats.reduce((n, b) => n + beatFrames(b), 0) - TRANSITION_FRAMES * Math.max(0, beats.length - 1)
}

/** Frame each beat starts at in the finished video (transitions overlap neighbours). */
export function beatStartFrames(beats: Beat[]): number[] {
  const starts: number[] = []
  let at = 0
  for (const b of beats) {
    starts.push(at)
    at += beatFrames(b) - TRANSITION_FRAMES
  }
  return starts
}

/** Scales every beat but the end card towards `lengthSec`, keeping each within 2–4 s. */
export function fitToLength(beats: Beat[], lengthSec: number): Beat[] {
  const end = beats.at(-1)!
  const body = beats.slice(0, -1)
  const bodyFrames = body.reduce((n, b) => n + beatFrames(b), 0)
  if (bodyFrames === 0) return beats
  const target = lengthSec * FPS + TRANSITION_FRAMES * (beats.length - 1) - beatFrames(end)
  const factor = target / bodyFrames
  return [...body.map((b) => ({ ...b, seconds: tenths(clamp(b.seconds * factor, L.minSeconds, L.maxSeconds)) })), end]
}

export interface FixedStoryboardInput {
  title: string
  blurb?: string | null
  bullets?: string[]
  pageCount: number
  cta: string
  hook?: string | null
  lengthSec: number
  style: AdVideoSpec['style']
}

/** No AI: built from what the publisher entered, used until (or instead of) directing. */
export function fixedStoryboard(input: FixedStoryboardInput): Storyboard {
  const pages = Math.min(input.pageCount, L.pages)
  const beats: Beat[] = [hookBeat(input.hook || input.title)]
  const firstSentence = (input.blurb ?? '').split(/(?<=[.!?])\s+/)[0]?.trim()
  if (firstSentence) beats.push({ kind: 'titleCard', text: tidyLine(firstSentence), seconds: 3 })
  if (pages >= 1) beats.push({ kind: 'bookOpen', page: 1, seconds: 3.5 })
  for (const p of [2, 3].filter((n) => n <= pages)) {
    beats.push({ kind: 'pageZoom', page: p, focus: { x: 0.5, y: 0.35, zoom: 1.5 }, seconds: 3 })
  }
  const bullet = input.bullets?.find((b) => b.trim())
  if (bullet) beats.push({ kind: 'audience', text: tidyLine(bullet), seconds: 3 })
  beats.push(endCardBeat(input.title, input.cta))
  return { theme: fixedTheme(input.style), beats: fitToLength(beats.slice(-L.beatsMax), input.lengthSec) }
}

/** Page numbers the storyboard shows; bookOpen also shows the page after its own. */
export function pagesUsed(sb: Storyboard): number[] {
  const used = new Set<number>()
  for (const b of sb.beats) {
    if (b.kind === 'pageZoom') used.add(b.page)
    if (b.kind === 'proof' && b.page) used.add(b.page)
    if (b.kind === 'bookOpen') {
      used.add(b.page)
      used.add(b.page + 1)
    }
  }
  return [...used].filter((p) => p <= L.pages).sort((a, b) => a - b)
}

/** The saved storyboard, or the fixed one built from the book. */
export function resolveStoryboard(
  spec: AdVideoSpec,
  book: { title: string | null; blurb: string | null; bullets: string[]; interiorImageUrls: string[] }
): Storyboard {
  return (
    spec.storyboard ??
    fixedStoryboard({
      title: book.title ?? 'Untitled book',
      blurb: book.blurb,
      bullets: book.bullets,
      pageCount: book.interiorImageUrls.length,
      cta: spec.script.cta,
      hook: spec.script.hook,
      lengthSec: getDurationForLength(spec.length),
      style: spec.style,
    })
  )
}

export const settingsPath = (publisherId: string) => `ads/${publisherId}/settings/`

const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/

/** True only for a file this app stored under `path` (local or Vercel Blob); never a traversal. */
export function ownsStoredFile(url: string, path: string): boolean {
  if (url.includes('..')) return false
  if (url.startsWith(`/api/files/${path}`)) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && BLOB_HOST.test(u.hostname) && u.pathname.startsWith(`/${path}`)
  } catch {
    return false
  }
}
