# Book Ad Director (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-card Instant video with a director-written, beat-based Remotion ad.
It shows the real 3D cover and real inside pages in an AI-drawn setting, with one short
idea per beat. The four reference ads are the bar.

**Architecture:**
- A storyboard (theme + 2–9 beats) lives in `Book.videoSpec.storyboard`.
- A vision model writes it after looking at the cover and pages. Code sanitizes it to
  strict limits, and a fixed storyboard covers AI failure and undirected books.
- A new Remotion composition `BookAd` plays the storyboard with `TransitionSeries`,
  a CSS-3D book, page pans, particles and grain.
- The instant export, campaign generation and the browser preview all use `BookAd`.

**Tech Stack:**
- Next.js App Router (this repo's version: read `node_modules/next/dist/docs/` before
  touching routes)
- Remotion 4.0.525 and `@remotion/transitions@4.0.525`
- AI SDK 7 `generateText` with file parts, through OpenRouter
- zod 4, vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-10-12-book-ad-director-design.md`

## Global Constraints

- Remotion packages stay at **4.0.525**. Install `@remotion/transitions@4.0.525` exactly,
  with no caret.
- Animation is driven only by `useCurrentFrame()` with `interpolate`/`spring`/`Easing`.
  No CSS `transition`/`animation` and no Tailwind animation classes inside compositions.
- Every `<TransitionSeries.Sequence>` gets `premountFor={fps}`, with `fps` from
  `useVideoConfig()`.
- `FPS = 30`. `TRANSITION_FRAMES = 12`.
- Storyboard limits:

  | Item | Limit |
  |---|---|
  | Beat text | ≤ 2 lines, ≤ 7 words per line, ≤ 60 characters |
  | Beat length | 2–4 s (end card 3–4 s) |
  | Beats | 2–9; first is `hook` or `titleCard`, last is `endCard` |
  | Pages | 1–6 |
  | End-card title / subtitle / CTA | 70 / 60 / 28 characters |
  | Setting prompt | 400 characters |

- The director may use **only numbers and claims found in the book's details or visible
  on its pages**.
- The vision model is `OPENROUTER_VISION_MODEL`, default `google/gemini-3.8-flash`.
- Instant export price is unchanged: `ads.video.instant` = 2 credits. Directing is free
  and rate-limited to 30 per hour per publisher.
- `theme.settingImageUrl` must be one of the publisher's own stored files
  (`ads/{publisherId}/settings/`), or null. It is checked on save and before reading
  on the server.
- Commits use the git identity Vijendrapratap
  (`44225657+Vijendrapratap@users.noreply.github.com`) with the trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit
  `scripts/dev.mjs`.
- Test commands:
  - `npm test -- <path>` for unit tests (it loads `.env.test`)
  - `npx tsc --noEmit`
  - Playwright on port 3100, which needs `DATABASE_URL`; stop the dev server first.

## Review Focus

1. **A book with no inside pages** (or broken page URLs): no page beats survive
   sanitizing, the fixed storyboard has none, and `BookAd` renders. Pinned in Task 1.
2. **A book with no cover:** `Book3D` shows a titled placeholder, and the render and
   preview don't crash. Pinned in Task 5 (`Book3D` placeholder) and checked by render in
   Task 8.
3. **Model output out of bounds:**
   - page numbers past the page count
   - 12+ beats
   - no end card, or the end card in the middle
   - 15-word lines
   - `seconds: 10`
   - a bad hex colour or an unknown font

   All are sanitized, never rejected wholesale. Pinned in Task 1.
4. **Text overlapping the book** at 16:9, 1:1 and 9:16 with text on either side. Pinned
   in Task 5 (`stageLayout` test).
5. **A foreign `settingImageUrl`** saved through PATCH, or one coming back from the
   client, is rejected or ignored. Pinned in Tasks 4 and 6.

---

### Task 1: Storyboard model, rules and timing

**Files:**
- Create: `lib/services/ads/videoBasics.ts`
- Create: `lib/services/ads/storyboard.ts`
- Test: `lib/services/ads/storyboard.test.ts`
- Modify: `lib/services/ads/videoSpec.ts`. Move `AD_FONTS`/`AdFontKey`/`FPS`/`clip` into
  `videoBasics.ts`, re-export them, and add `storyboard` to the schema.

**Interfaces:**
- Produces:
  - from `videoBasics.ts`: `AD_FONTS`, `AdFontKey`, `FPS`, `clip(text, max)`
  - from `storyboard.ts`:
    - `BEAT_KINDS`, `BeatKind`, `PARTICLES`, `STORYBOARD_LIMITS`, `TRANSITION_FRAMES`
    - `beatSchema`, `Beat`, `themeSchema`, `storyboardSchema`, `Storyboard`
    - `storyboardDraftSchema`, `StoryboardDraft`
    - `tidyLine(text): string`
    - `sanitizeStoryboard(draft, ctx): Storyboard`
    - `fixedStoryboard(input): Storyboard`
    - `fitToLength(beats, lengthSec): Beat[]`
    - `beatFrames(beat): number`
    - `storyboardDurationInFrames(beats): number`
    - `beatStartFrames(beats): number[]`
    - `pagesUsed(sb): number[]`
    - `resolveStoryboard(spec, book): Storyboard`
    - `ownsStoredFile(url, path): boolean`
    - `settingsPath(publisherId): string`
  - `AdVideoSpec` gains `storyboard?: Storyboard`

- [ ] **Step 1: Move the shared basics out of videoSpec**

Create `lib/services/ads/videoBasics.ts`:

```ts
/** Shared by videoSpec.ts and storyboard.ts; kept apart so neither imports the other at runtime. */
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

export const FPS = 30

/** Cuts at a word boundary so an automatic default never ends mid-word. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const head = clean.slice(0, max + 1)
  const lastSpace = head.lastIndexOf(' ')
  const cut = lastSpace > max * 0.5 ? head.slice(0, lastSpace) : clean.slice(0, max)
  return cut.replace(/[\s,;:•–—-]+$/, '')
}
```

In `lib/services/ads/videoSpec.ts`, delete the `AD_FONTS` const, the `AdFontKey` type,
`export const FPS = 30` and the whole `clip` function. Add at the top:

```ts
import { AD_FONTS, FPS, clip, type AdFontKey } from './videoBasics'
import { storyboardSchema } from './storyboard'

export { AD_FONTS, FPS, clip, type AdFontKey }
```

- [ ] **Step 2: Write the failing tests**

Create `lib/services/ads/storyboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  TRANSITION_FRAMES,
  beatStartFrames,
  fitToLength,
  fixedStoryboard,
  ownsStoredFile,
  pagesUsed,
  sanitizeStoryboard,
  storyboardDurationInFrames,
  storyboardSchema,
  tidyLine,
  type Beat,
  type StoryboardDraft,
} from './storyboard'
import { adVideoSpecSchema, defaultVideoSpec, presetStyle } from './videoSpec'

const style = presetStyle('cinematic')
const ctx = { pageCount: 3, title: 'Murder at Thornwick Mill', cta: 'Get your copy', lengthSec: 20, style }
const draft = (beats: StoryboardDraft['beats'], theme: Partial<StoryboardDraft['theme']> = {}): StoryboardDraft => ({
  theme: { settingPrompt: 'a library desk at night', palette: { bg: '#1b2a1f', ink: '#f4ead5', accent: '#c8a24a' }, font: 'playfair', particles: 'dust', cornerCover: false, ...theme },
  beats,
})

describe('tidyLine', () => {
  it('keeps a line that already fits, including its own line break', () => {
    expect(tidyLine('It was not.\nAnd it did not stop.')).toBe('It was not.\nAnd it did not stop.')
  })
  it('rewraps a long line into two lines of at most 7 words', () => {
    const out = tidyLine('one two three four five six seven eight nine ten')
    expect(out.split('\n')).toEqual(['one two three four five', 'six seven eight nine ten'])
  })
  it('drops words past 14 and keeps it under 60 characters', () => {
    const out = tidyLine('Extraordinary sentences contain wonderfully lengthy vocabulary everywhere imaginable today alright friends okay sure yes more')
    expect(out.length).toBeLessThanOrEqual(60)
    expect(out.split('\n').every((l) => l.split(' ').length <= 7)).toBe(true)
  })
})

describe('sanitizeStoryboard', () => {
  it('turns a reasonable draft into a valid storyboard', () => {
    const sb = sanitizeStoryboard(
      draft([
        { kind: 'hook', text: 'A miller is dead.', side: 'left', seconds: 3 },
        { kind: 'pageZoom', text: '120 cases. One per page.', page: 2, focus: { x: 0.4, y: 0.3, zoom: 1.8 }, seconds: 3 },
        { kind: 'endCard', title: 'Murder at Thornwick Mill', subtitle: 'Book One', cta: 'Get your copy', seconds: 3.5 },
      ]),
      ctx
    )
    expect(storyboardSchema.safeParse(sb).success).toBe(true)
    expect(sb.beats.map((b) => b.kind)).toEqual(['hook', 'pageZoom', 'endCard'])
  })

  it('repairs out-of-bounds output instead of rejecting it', () => {
    const beats: StoryboardDraft['beats'] = [
      { kind: 'proof', text: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen', seconds: 10 },
      { kind: 'endCard', title: 'Too early', cta: 'Buy', seconds: 3 },
      { kind: 'pageZoom', page: 9, seconds: 3 },
      { kind: 'bookOpen', page: 0, seconds: 3 },
      ...Array.from({ length: 12 }, () => ({ kind: 'audience' as const, text: 'For puzzle fans', seconds: 1 })),
    ]
    const sb = sanitizeStoryboard(draft(beats, { palette: { bg: 'navy', ink: '#fff', accent: '#c8a24a' }, font: 'comic-sans', particles: 'confetti' }), ctx)
    expect(storyboardSchema.safeParse(sb).success).toBe(true)
    expect(sb.beats[0].kind).toBe('hook') // no hook/titleCard first, so one is added
    expect(sb.beats.at(-1)!.kind).toBe('endCard')
    expect(sb.beats.filter((b) => b.kind === 'endCard')).toHaveLength(1)
    expect(sb.beats.length).toBeLessThanOrEqual(9)
    expect(sb.beats.some((b) => b.kind === 'pageZoom' || b.kind === 'bookOpen')).toBe(false)
    expect(sb.theme.palette.bg).toBe(style.colors.bgTo)
    expect(sb.theme.font).toBe(style.font)
    expect(sb.theme.particles).toBe('none')
  })

  it('never keeps a page beat when the book has no pages', () => {
    const sb = sanitizeStoryboard(
      draft([
        { kind: 'titleCard', text: 'The camp called it an accident.', seconds: 3 },
        { kind: 'bookOpen', page: 1, seconds: 3 },
        { kind: 'proof', text: '20 puzzles', page: 1, seconds: 3 },
        { kind: 'endCard', title: 'T', cta: 'Get it', seconds: 3 },
      ]),
      { ...ctx, pageCount: 0 }
    )
    expect(pagesUsed(sb)).toEqual([])
  })
})

describe('timing', () => {
  const beats: Beat[] = [
    { kind: 'hook', text: 'A', side: 'left', seconds: 3 },
    { kind: 'audience', text: 'B', seconds: 2 },
    { kind: 'endCard', title: 'T', cta: 'C', seconds: 3 },
  ]
  it('subtracts one transition per join', () => {
    expect(storyboardDurationInFrames(beats)).toBe(90 + 60 + 90 - 2 * TRANSITION_FRAMES)
    expect(beatStartFrames(beats)).toEqual([0, 90 - TRANSITION_FRAMES, 90 + 60 - 2 * TRANSITION_FRAMES])
  })
  it('stretches the body towards the chosen length and keeps each beat within 2–4 s', () => {
    const fitted = fitToLength(beats, 15)
    expect(fitted.at(-1)).toEqual(beats.at(-1))
    expect(fitted.slice(0, -1).every((b) => b.seconds >= 2 && b.seconds <= 4)).toBe(true)
    expect(storyboardDurationInFrames(fitted)).toBeGreaterThan(storyboardDurationInFrames(beats))
  })
})

describe('fixedStoryboard', () => {
  it('uses only what the publisher gave: title, blurb, bullets, pages', () => {
    const sb = fixedStoryboard({ title: 'Jumbo Autumn Word Search', blurb: 'Large print puzzles for fall. More inside.', bullets: ['100 large-print puzzles'], pageCount: 3, cta: 'Get your copy', lengthSec: 20, style })
    expect(storyboardSchema.safeParse(sb).success).toBe(true)
    expect(sb.beats.map((b) => b.kind)).toEqual(['hook', 'titleCard', 'bookOpen', 'pageZoom', 'pageZoom', 'audience', 'endCard'])
    expect(pagesUsed(sb)).toEqual([1, 2, 3])
  })
  it('still makes a valid video with no pages, blurb or bullets', () => {
    const sb = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Get it', lengthSec: 15, style })
    expect(storyboardSchema.safeParse(sb).success).toBe(true)
    expect(pagesUsed(sb)).toEqual([])
  })
})

describe('videoSpec with a storyboard', () => {
  it('accepts a spec that carries a storyboard and one without', () => {
    const spec = defaultVideoSpec({ title: 'T' })
    expect(adVideoSpecSchema.safeParse(spec).success).toBe(true)
    const storyboard = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
    expect(adVideoSpecSchema.safeParse({ ...spec, storyboard }).success).toBe(true)
  })
})

describe('ownsStoredFile', () => {
  it('accepts only this publisher’s own files, locally or on Blob', () => {
    expect(ownsStoredFile('/api/files/ads/pub_1/settings/a.png', 'ads/pub_1/settings/')).toBe(true)
    expect(ownsStoredFile('https://abc123.public.blob.vercel-storage.com/ads/pub_1/settings/a.png', 'ads/pub_1/settings/')).toBe(true)
    expect(ownsStoredFile('/api/files/ads/pub_2/settings/a.png', 'ads/pub_1/settings/')).toBe(false)
    expect(ownsStoredFile('https://evil.example/ads/pub_1/settings/a.png', 'ads/pub_1/settings/')).toBe(false)
    expect(ownsStoredFile('/api/files/ads/pub_1/settings/../../pub_2/x.png', 'ads/pub_1/settings/')).toBe(false)
  })
})
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npm test -- lib/services/ads/storyboard.test.ts`
Expected: FAIL with `Failed to resolve import "./storyboard"`.

- [ ] **Step 4: Implement `lib/services/ads/storyboard.ts`**

```ts
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
  let body = beats.filter((b) => b.kind !== 'endCard')
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
```

In `videoSpec.ts`, add the field to `adVideoSpecSchema`, after `music`:

```ts
  // Written by the director (or saved from the editor); absent means "use the fixed storyboard".
  storyboard: storyboardSchema.optional(),
```

- [ ] **Step 5: Run them to make sure they pass**

Run: `npm test -- lib/services/ads/storyboard.test.ts lib/services/ads/videoSpec.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`. Expected: no output.

```bash
git add lib/services/ads/videoBasics.ts lib/services/ads/storyboard.ts lib/services/ads/storyboard.test.ts lib/services/ads/videoSpec.ts
git commit -m "feat(video): storyboard model with repair rules and timing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Let structured AI calls see images

**Files:**
- Modify: `lib/providers/ai.ts`
- Test: `lib/providers/ai.test.ts`

**Interfaces:**
- Produces:
  - `GenerateStructuredOptions.images?: { data: Buffer; mediaType: string }[]`
  - `DEFAULT_VISION_MODEL = 'google/gemini-3.8-flash'`
  - `getVisionModelName(): string`

- [ ] **Step 1: Write the failing tests** (append to `lib/providers/ai.test.ts`)

```ts
describe('generateStructured with images', () => {
  it('sends the prompt and each image as file parts of one user message', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { ok: true } } as never)
    const png = Buffer.from([137, 80, 78, 71])
    const result = await generateStructured({
      label: 'vision',
      schema: z.object({ ok: z.boolean() }),
      system: 'look',
      prompt: 'What is on the cover?',
      images: [{ data: png, mediaType: 'image/png' }],
      fallback: () => ({ ok: false }),
      credentials: { apiKey: 'k' },
    })
    expect(result.source).toBe('ai')
    const call = vi.mocked(generateText).mock.calls[0][0] as any
    expect(call.prompt).toBeUndefined()
    expect(call.system).toBe('look')
    expect(call.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is on the cover?' },
          { type: 'file', mediaType: 'image/png', data: png },
        ],
      },
    ])
  })

  it('reads the vision model from OPENROUTER_VISION_MODEL', () => {
    delete process.env.OPENROUTER_VISION_MODEL
    expect(getVisionModelName()).toBe(DEFAULT_VISION_MODEL)
    process.env.OPENROUTER_VISION_MODEL = 'anthropic/claude-haiku-5.5'
    expect(getVisionModelName()).toBe('anthropic/claude-haiku-5.5')
  })
})
```

Add `getVisionModelName` and `DEFAULT_VISION_MODEL` to the test file's import list from
`./ai`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `npm test -- lib/providers/ai.test.ts`
Expected: FAIL. `getVisionModelName` is not exported, and `messages` is undefined.

- [ ] **Step 3: Implement**

In `lib/providers/ai.ts`:

```ts
export const DEFAULT_VISION_MODEL = 'google/gemini-3.8-flash'
```

Add to `GenerateStructuredOptions<T>`:

```ts
  /** Pictures the model should look at, sent after the prompt in the same message. */
  images?: { data: Buffer; mediaType: string }[]
```

In `generateStructured`, replace `prompt: options.prompt,` inside `generateText({...})`
with:

```ts
      ...(options.images?.length
        ? {
            messages: [
              {
                role: 'user' as const,
                content: [
                  { type: 'text' as const, text: options.prompt },
                  ...options.images.map((img) => ({ type: 'file' as const, mediaType: img.mediaType, data: img.data })),
                ],
              },
            ],
          }
        : { prompt: options.prompt }),
```

Add after `getVideoModelName`:

```ts
/** A model that can look at the cover and pages; never the publisher's text-model setting. */
export function getVisionModelName(): string {
  return process.env.OPENROUTER_VISION_MODEL || DEFAULT_VISION_MODEL
}
```

Add `OPENROUTER_VISION_MODEL=google/gemini-3.8-flash` to `.env.example`, on the line
after `OPENROUTER_MODEL`.

- [ ] **Step 4: Run them to make sure they pass**

Run: `npm test -- lib/providers/ai.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/providers/ai.ts lib/providers/ai.test.ts .env.example
git commit -m "feat(ai): structured calls can look at images; vision model setting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The director (system prompt, prompt builder, setting picture)

**Files:**
- Create: `lib/services/ads/adDirector.ts`
- Test: `lib/services/ads/adDirector.test.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `storyboardDraftSchema`, `sanitizeStoryboard`, `fixedStoryboard`,
    `settingsPath`, `Storyboard`
  - from Task 2: `generateStructured` with `images`, `getVisionModelName`
  - existing: `generateAiImage`, `storeFile`
- Produces:
  - `DIRECTOR_SYSTEM: string`
  - `interface DirectorFacts { title; author?; blurb?; bullets?; categories?; printLength?; pageCount; cta; hook? }`
  - `interface DirectorImage { label: string; data: Buffer; mediaType: string }`
  - `buildDirectorPrompt(facts, images, options): string`
  - `directAd(facts, images, options): Promise<AiResult<Storyboard>>`
  - `drawSetting(prompt, format, publisherId): Promise<string | null>`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/ai', () => ({
  generateStructured: vi.fn(),
  generateAiImage: vi.fn(),
  getVisionModelName: () => 'google/gemini-3.8-flash',
}))
vi.mock('@/lib/providers/storage', () => ({ storeFile: vi.fn(async (p: string) => ({ url: `/api/files/${p}` })) }))

import { generateAiImage, generateStructured } from '@/lib/providers/ai'
import { DIRECTOR_SYSTEM, buildDirectorPrompt, directAd, drawSetting, type DirectorFacts } from './adDirector'
import { fixedStoryboard, storyboardSchema } from './storyboard'
import { presetStyle } from './videoSpec'

const style = presetStyle('cinematic')
const facts: DirectorFacts = {
  title: 'Murder at Thornwick Mill',
  author: 'Ruby Fenwick',
  blurb: 'A murder mystery told through 120 word searches.',
  bullets: ['120 cases, one per page'],
  categories: ['Word Search'],
  printLength: 130,
  pageCount: 2,
  cta: 'Get your copy',
}
const images = [
  { label: 'cover', data: Buffer.from('c'), mediaType: 'image/png' },
  { label: 'page 1', data: Buffer.from('1'), mediaType: 'image/png' },
]
const options = { format: '16:9' as const, lengthSec: 20, mood: 'suspenseful', style }

beforeEach(() => {
  vi.mocked(generateStructured).mockReset()
  vi.mocked(generateAiImage).mockReset()
})

describe('DIRECTOR_SYSTEM', () => {
  it('carries the rules that make the reference ads work', () => {
    for (const rule of ['sound off', 'Use only numbers and claims', '7 words', 'end card', 'No text, no book']) {
      expect(DIRECTOR_SYSTEM).toContain(rule)
    }
  })
})

describe('buildDirectorPrompt', () => {
  it('lists the facts, the attached images in order, and the target length', () => {
    const prompt = buildDirectorPrompt(facts, images, options)
    expect(prompt).toContain('Title: Murder at Thornwick Mill')
    expect(prompt).toContain('Print length: 130 pages')
    expect(prompt).toContain('Images attached, in this order: cover, page 1')
    expect(prompt).toContain('Inside pages you can show: 1 to 2')
    expect(prompt).toContain('about 20 seconds')
  })
  it('includes the current storyboard and the instruction when revising', () => {
    const current = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
    const prompt = buildDirectorPrompt(facts, images, { ...options, current, instruction: 'make it spookier' })
    expect(prompt).toContain(JSON.stringify(current))
    expect(prompt).toContain('make it spookier')
  })
})

describe('directAd', () => {
  it('asks the vision model with the images and returns a sanitized storyboard', async () => {
    vi.mocked(generateStructured).mockResolvedValue({
      source: 'ai',
      data: {
        theme: { settingPrompt: 'library desk', palette: { bg: '#123456', ink: '#ffffff', accent: '#c8a24a' }, font: 'playfair', particles: 'dust', cornerCover: false },
        beats: [
          { kind: 'hook', text: 'A miller is dead.', side: 'left', seconds: 3 },
          { kind: 'pageZoom', page: 5, seconds: 3 },
          { kind: 'endCard', title: 'Murder at Thornwick Mill', cta: 'Get your copy', seconds: 3 },
        ],
      },
    } as never)
    const result = await directAd(facts, images, options)
    const call = vi.mocked(generateStructured).mock.calls[0][0]
    expect(call.model).toBe('google/gemini-3.8-flash')
    expect(call.images).toEqual(images.map(({ data, mediaType }) => ({ data, mediaType })))
    expect(result.source).toBe('ai')
    expect(storyboardSchema.safeParse(result.data).success).toBe(true)
    expect(result.data.beats.some((b) => b.kind === 'pageZoom')).toBe(false) // page 5 does not exist
  })

  it('keeps the current storyboard when a revision fails', async () => {
    const current = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
    vi.mocked(generateStructured).mockImplementation(async (o: any) => ({ source: 'fallback', data: o.fallback() }))
    const result = await directAd(facts, images, { ...options, current })
    expect(result.source).toBe('fallback')
    expect(result.data.beats).toEqual(current.beats)
  })
})

describe('drawSetting', () => {
  it('draws the setting in the video’s shape and stores it under the publisher', async () => {
    vi.mocked(generateAiImage).mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/png', dataUri: '' })
    const url = await drawSetting('a library desk at night', '9:16', 'pub_1')
    expect(vi.mocked(generateAiImage).mock.calls[0][0]).toMatch(/Tall portrait frame.*No text/s)
    expect(url).toMatch(/^\/api\/files\/ads\/pub_1\/settings\/.+\.png$/)
  })
  it('returns null when nothing could be drawn', async () => {
    vi.mocked(generateAiImage).mockResolvedValue(null)
    expect(await drawSetting('x', '16:9', 'pub_1')).toBeNull()
    expect(await drawSetting('', '16:9', 'pub_1')).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npm test -- lib/services/ads/adDirector.test.ts`
Expected: FAIL with `Failed to resolve import "./adDirector"`.

- [ ] **Step 3: Implement `lib/services/ads/adDirector.ts`**

```ts
import { generateAiImage, generateStructured, getVisionModelName, type AiResult } from '@/lib/providers/ai'
import { storeFile } from '@/lib/providers/storage'
import { AD_FONTS } from './videoBasics'
import {
  STORYBOARD_LIMITS,
  fixedStoryboard,
  sanitizeStoryboard,
  settingsPath,
  storyboardDraftSchema,
  type Storyboard,
} from './storyboard'
import type { AdVideoSpec } from './videoSpec'

export const DIRECTOR_SYSTEM = `You direct short video ads that sell books on Amazon and in social feeds. You look at the book's real cover and inside pages, read its details, and write the storyboard our video engine plays.

How these ads are watched:
- They autoplay with the sound off, often in a small tile. Every word is read, not heard.
- People decide in the first two seconds. The first beat must make them curious or show them something they want.

What the engine does with your storyboard:
- It always shows the real cover as a 3D book and the real inside pages. It never redraws them, so never describe changes to them.
- It draws one background setting from your description and places the book in it.
- Each beat is one scene of 2 to 4 seconds. Scenes blend into each other.

Beat types:
- hook: the opening line beside the book. Open with a question, a tension or the strongest promise.
- titleCard: one sentence alone on a dark card, like a film trailer. For stories, tell the premise in 2 to 4 short cards.
- pageZoom: one inside page fills the screen and the camera moves in to the part you choose (focus x and y from 0 to 1 across and down the page, zoom 1.3 to 2.5). Use it to prove a line with the page itself; its text is a short caption.
- bookOpen: the book opens on a page and the page after it. Use it to show what is inside.
- proof: a concrete, checkable fact, shown beside the cover or a page ("120 cases. One per page.").
- audience: who the book is for, or who it is a gift for.
- endCard: the title, an optional series or subtitle line, and the call to action. Always last, exactly once.

How to build it:
- 4 to 8 beats, then the end card. Order: hook first, then what is inside with real numbers, then who it is for, then the end card.
- Puzzle, activity and colouring books: show pages early (bookOpen, pageZoom) and lead with counts and print size.
- Stories and novels: lead with tension (a hook or titleCards with the premise), then the book.
- Children's books: warmth, the age range and what the child gets.
- Non-fiction: the reader's problem, then what they will be able to do.

Writing rules:
- One idea per beat. At most 7 words a line and at most 2 lines; break the line where a reader would pause.
- Use only numbers and claims found in the book's details or clearly visible on its pages. Never invent awards, rankings, review quotes, prices or counts.
- Keep the title and author out of the hook; the end card carries the title.
- Write in the language of the book's details.

Look and feel:
- palette: three hex colours taken from the cover: bg (a deep or soft colour from the cover for the background), ink (a text colour readable on bg) and accent (a highlight colour from the cover).
- font: one of ${AD_FONTS.map((f) => f.key).join(', ')}. Serif (playfair, lora, cinzel, merriweather) for literary, mystery and history; bold condensed (bebas, montserrat) for puzzles and activity books; caveat for young children; inter for non-fiction.
- particles: leaves, snow, dust, embers or none, to match the setting and season.
- settingPrompt: one place where the book could sit, matching the genre and season: a surface in the foreground with empty space, soft light, the background out of focus. No text, no book, no people's faces.
- cornerCover: true for trailer-style ads made mostly of title cards, otherwise false.`

export interface DirectorFacts {
  title: string
  author?: string | null
  blurb?: string | null
  bullets?: string[]
  categories?: string[]
  printLength?: number | null
  pageCount: number
  cta: string
  hook?: string | null
}

export interface DirectorImage {
  /** "cover" or "page N"; listed in the prompt so the model knows which picture is which. */
  label: string
  data: Buffer
  mediaType: string
}

export interface DirectorOptions {
  format: AdVideoSpec['format']
  lengthSec: number
  mood: string
  style: AdVideoSpec['style']
  current?: Storyboard
  instruction?: string
}

export function buildDirectorPrompt(facts: DirectorFacts, images: DirectorImage[], options: DirectorOptions): string {
  const pages = Math.min(facts.pageCount, STORYBOARD_LIMITS.pages)
  const lines = [
    `Title: ${facts.title}`,
    facts.author ? `Author: ${facts.author}` : null,
    facts.categories?.length ? `Categories: ${facts.categories.join(', ')}` : null,
    facts.printLength ? `Print length: ${facts.printLength} pages` : null,
    facts.bullets?.length ? `Publisher's bullets (verified):\n- ${facts.bullets.join('\n- ')}` : null,
    facts.blurb ? `Description: ${facts.blurb.slice(0, 1500)}` : null,
    `Images attached, in this order: ${images.map((i) => i.label).join(', ') || 'none'}`,
    pages > 0 ? `Inside pages you can show: 1 to ${pages}` : 'There are no inside pages: do not use pageZoom or bookOpen.',
    `Video shape: ${options.format}. Target length: about ${options.lengthSec} seconds. Mood: ${options.mood}.`,
    `Call to action to use on the end card: ${facts.cta}`,
    '',
  ]
  if (options.current) {
    lines.push(
      'Here is the current storyboard as JSON. Revise it following the publisher’s instruction and keep everything the instruction does not ask to change.',
      JSON.stringify(options.current),
      '',
      `Publisher's instruction: ${options.instruction || 'Make it more compelling.'}`
    )
  } else if (options.instruction) {
    lines.push(`Publisher's direction: ${options.instruction}`)
  }
  return lines.filter((l) => l !== null).join('\n')
}

export async function directAd(facts: DirectorFacts, images: DirectorImage[], options: DirectorOptions): Promise<AiResult<Storyboard>> {
  const ctx = { pageCount: facts.pageCount, title: facts.title, cta: facts.cta, lengthSec: options.lengthSec, style: options.style }
  const result = await generateStructured({
    label: options.current ? 'ad-director-revise' : 'ad-director',
    schema: storyboardDraftSchema,
    system: DIRECTOR_SYSTEM,
    prompt: buildDirectorPrompt(facts, images, options),
    images: images.map(({ data, mediaType }) => ({ data, mediaType })),
    model: getVisionModelName(),
    temperature: 0.8,
    timeoutMs: 60_000,
    // A failed revision must not throw away what the publisher already has.
    fallback: () =>
      options.current ??
      fixedStoryboard({ title: facts.title, pageCount: facts.pageCount, cta: facts.cta, hook: facts.hook, bullets: facts.bullets, lengthSec: options.lengthSec, style: options.style }),
  })
  if (result.source === 'fallback' && options.current) return { ...result, data: options.current }
  return { ...result, data: sanitizeStoryboard(result.data, ctx) }
}

const SHAPE_WORDS: Record<AdVideoSpec['format'], string> = {
  '16:9': 'Wide landscape frame',
  '1:1': 'Square frame',
  '9:16': 'Tall portrait frame',
}

/** Draws the ad's background once and stores it; null when there is nothing to draw or drawing failed. */
export async function drawSetting(prompt: string, format: AdVideoSpec['format'], publisherId: string): Promise<string | null> {
  if (!prompt.trim()) return null
  const image = await generateAiImage(
    `${prompt.trim()}. ${SHAPE_WORDS[format]}. Cinematic photograph, soft directional light, shallow depth of field, rich but uncluttered. Leave clear empty space for a book and a line of text. No text, letters, logos, books or faces.`,
    { timeoutMs: 90_000 }
  )
  if (!image) return null
  const ext = image.contentType.includes('png') ? 'png' : image.contentType.includes('webp') ? 'webp' : 'jpg'
  const name = `${settingsPath(publisherId)}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  return (await storeFile(name, image.buffer, image.contentType)).url
}
```

- [ ] **Step 4: Run them to make sure they pass**

Run: `npm test -- lib/services/ads/adDirector.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/ads/adDirector.ts lib/services/ads/adDirector.test.ts
git commit -m "feat(video): ad director prompt and setting picture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Direct-my-ad route, and saving storyboards safely

**Files:**
- Create: `app/api/ads/projects/[id]/video/direct/route.ts`
- Test: `app/api/ads/projects/[id]/video/direct/route.test.ts`
- Modify: `lib/services/ads/videoAssets.ts` (add `directorImages`)
- Modify: `app/api/ads/projects/[id]/route.ts`:
  - reject a foreign `settingImageUrl`
  - refit the storyboard when the Configure page changes the length
- Test: `app/api/ads/projects/[id]/route.test.ts`

**Interfaces:**
- Consumes:
  - from Task 3: `directAd`, `drawSetting`, `DirectorImage`
  - from Task 1: `ownsStoredFile`, `settingsPath`, `fitToLength`
- Produces:
  - `POST /api/ads/projects/:id/video/direct` with body `{ instruction?: string, revise?: boolean }`
    - 200 → `{ spec: AdVideoSpec, source: 'ai' | 'fallback' }`
    - 429 → over the rate limit
    - 400 → AI not configured
    - 404 → not this publisher's book
  - `directorImages(book): Promise<DirectorImage[]>`

- [ ] **Step 1: Read the route-handler guide for this Next version**

Run: `ls node_modules/next/dist/docs/` and read the route handlers page under app routing.
Confirm `params` is a Promise in route handlers, as the existing routes use it.

- [ ] **Step 2: Write the failing route tests**

`app/api/ads/projects/[id]/video/direct/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultVideoSpec, presetStyle } from '@/lib/services/ads/videoSpec'
import { fixedStoryboard } from '@/lib/services/ads/storyboard'

const style = presetStyle('cinematic')
const directed = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', bullets: [], categories: [], frontCoverUrl: '/api/files/ads/pub_1/c.png',
  interiorImageUrls: ['/api/files/ads/pub_1/p1.png'], customHook: null, ctaText: null, videoStyle: null, videoFormat: null,
  videoLength: null, videoMood: null, videoSpec: defaultVideoSpec({ title: 'T' }),
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/providers/ai', () => ({ isAiConfigured: vi.fn(() => true) }))
vi.mock('@/lib/rateLimit', () => ({ rateLimited: vi.fn(() => false) }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/services/ads/videoAssets', () => ({ directorImages: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/services/ads/adDirector', () => ({ directAd: vi.fn(), drawSetting: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { book: { update: vi.fn().mockResolvedValue({}) } } }))

import { POST } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { directAd, drawSetting } from '@/lib/services/ads/adDirector'
import { rateLimited } from '@/lib/rateLimit'
import { prisma } from '@/lib/db'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const req = (body: object = {}) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
  vi.mocked(directAd).mockResolvedValue({ source: 'ai', data: { ...directed, theme: { ...directed.theme, settingPrompt: 'library desk' } } })
  vi.mocked(drawSetting).mockResolvedValue('/api/files/ads/pub_1/settings/s.png')
})

describe('POST /api/ads/projects/:id/video/direct', () => {
  it('directs, draws the setting once, saves and returns the spec', async () => {
    const res = await POST(req(), ctx)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.source).toBe('ai')
    expect(json.spec.storyboard.theme.settingImageUrl).toBe('/api/files/ads/pub_1/settings/s.png')
    expect(drawSetting).toHaveBeenCalledWith('library desk', '16:9', 'pub_1')
    expect(vi.mocked(prisma.book.update).mock.calls[0][0]).toMatchObject({ where: { id: 'book_1' }, data: { videoSpec: json.spec } })
  })

  it('keeps the existing setting picture when a revision keeps the same setting', async () => {
    const saved = { ...directed, theme: { ...directed.theme, settingPrompt: 'library desk', settingImageUrl: '/api/files/ads/pub_1/settings/old.png' } }
    vi.mocked(getBookForPublisher).mockResolvedValue({ ...book, videoSpec: { ...book.videoSpec, storyboard: saved } } as any)
    const json = await (await POST(req({ revise: true, instruction: 'shorter' }), ctx)).json()
    expect(vi.mocked(directAd).mock.calls[0][2]).toMatchObject({ current: saved, instruction: 'shorter' })
    expect(drawSetting).not.toHaveBeenCalled()
    expect(json.spec.storyboard.theme.settingImageUrl).toBe('/api/files/ads/pub_1/settings/old.png')
  })

  it('does not draw anything when the AI fell back', async () => {
    vi.mocked(directAd).mockResolvedValue({ source: 'fallback', data: directed })
    await POST(req(), ctx)
    expect(drawSetting).not.toHaveBeenCalled()
  })

  it('refuses over the rate limit and for another publisher’s book', async () => {
    vi.mocked(rateLimited).mockReturnValueOnce(true)
    expect((await POST(req(), ctx)).status).toBe(429)
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await POST(req(), ctx)).status).toBe(404)
  })
})
```

Append to `app/api/ads/projects/[id]/route.test.ts`, following that file's existing
mocks and `PATCH` helper; read the file first:

```ts
  it('rejects a storyboard whose setting picture is not this publisher’s file', async () => {
    const storyboard = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style: presetStyle('cinematic') })
    const videoSpec = { ...defaultVideoSpec({ title: 'T' }), storyboard: { ...storyboard, theme: { ...storyboard.theme, settingImageUrl: '/api/files/ads/pub_2/settings/x.png' } } }
    const res = await PATCH(jsonReq({ videoSpec }), ctx)
    expect(res.status).toBe(400)
  })

  it('refits a saved storyboard when the Configure page changes the length', async () => {
    const storyboard = fixedStoryboard({ title: 'T', blurb: 'One. Two.', bullets: ['x'], pageCount: 0, cta: 'Go', lengthSec: 15, style: presetStyle('cinematic') })
    // book row with videoLength '15s' and this storyboard saved
    // PATCH { videoLength: '30s' } → saved spec.length '30s' and longer storyboard beats
  })
```

Write the second test fully against that file's book fixture:
- set `videoLength: '15s'` and `videoSpec: { ...defaultVideoSpec(...), storyboard }` on the
  fixture
- PATCH `{ videoLength: '30s' }`
- assert that `prisma.book.update` received `videoSpec.length === '30s'` and
  `storyboardDurationInFrames(saved.storyboard.beats) > storyboardDurationInFrames(storyboard.beats)`

- [ ] **Step 3: Run them to make sure they fail**

Run: `npm test -- "app/api/ads/projects/[id]/video/direct" "app/api/ads/projects/[id]/route.test.ts"`
Expected: FAIL. The direct route module is missing, the foreign setting gets 200, and the
storyboard isn't refitted.

- [ ] **Step 4: Implement**

Add `directorImages` to `lib/services/ads/videoAssets.ts`:

```ts
import type { DirectorImage } from './adDirector'
import { STORYBOARD_LIMITS } from './storyboard'

/** The cover and up to 6 pages as raw bytes for the director; pictures that fail to load are skipped. */
export async function directorImages(book: { frontCoverUrl: string | null; interiorImageUrls: string[] }): Promise<DirectorImage[]> {
  const sources = [
    { label: 'cover', url: book.frontCoverUrl },
    ...book.interiorImageUrls.slice(0, STORYBOARD_LIMITS.pages).map((url, i) => ({ label: `page ${i + 1}`, url })),
  ]
  const loaded = await Promise.all(
    sources.map(async ({ label, url }) => {
      if (!url) return null
      try {
        const file = await readStoredFile(url)
        return { label, data: file.data, mediaType: file.contentType }
      } catch {
        return null
      }
    })
  )
  // ponytail: images go at stored size; downscale here if token cost or latency becomes a problem.
  return loaded.filter((i): i is DirectorImage => i !== null)
}
```

`app/api/ads/projects/[id]/video/direct/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { isAiConfigured } from '@/lib/providers/ai'
import { rateLimited } from '@/lib/rateLimit'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { bookVideoSource, readVideoSpec, type AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { directorImages } from '@/lib/services/ads/videoAssets'
import { directAd, drawSetting } from '@/lib/services/ads/adDirector'
import { getDurationForLength } from '@/lib/services/trailer/options'
import { prisma } from '@/lib/db'

export const maxDuration = 180

const bodySchema = z.object({
  instruction: z.string().trim().max(400).optional(),
  revise: z.boolean().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  if (rateLimited(`direct:${publisherId}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  if (!isAiConfigured()) return NextResponse.json({ error: 'AI directing is not available right now.' }, { status: 400 })

  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  const current = parsed.data.revise ? spec.storyboard : undefined
  const result = await directAd(
    {
      title: book.title ?? 'Untitled book',
      author: book.author,
      blurb: book.blurb,
      bullets: book.bullets,
      categories: book.categories,
      pageCount: book.interiorImageUrls.length,
      cta: spec.script.cta,
      hook: book.customHook,
    },
    await directorImages(book),
    { format: spec.format, lengthSec: getDurationForLength(spec.length), mood: spec.mood, style: spec.style, current, instruction: parsed.data.instruction }
  )

  // Draw a new setting only when the AI actually wrote a different one.
  const sameSetting = current && current.theme.settingPrompt === result.data.theme.settingPrompt
  const settingImageUrl =
    result.source === 'ai' && !sameSetting
      ? await drawSetting(result.data.theme.settingPrompt, spec.format, publisherId)
      : (current?.theme.settingImageUrl ?? null)

  const next: AdVideoSpec = { ...spec, storyboard: { ...result.data, theme: { ...result.data.theme, settingImageUrl } } }
  await prisma.book.update({ where: { id: book.id }, data: { videoSpec: next } })
  return NextResponse.json({ spec: next, source: result.source })
}
```

In `app/api/ads/projects/[id]/route.ts`, import
`import { fitToLength, ownsStoredFile, settingsPath } from '@/lib/services/ads/storyboard'`
and `getDurationForLength` from `@/lib/services/trailer/options`.

After the music ownership check, add:

```ts
    const settingUrl = update.videoSpec?.storyboard?.theme.settingImageUrl
    if (settingUrl && !ownsStoredFile(settingUrl, settingsPath(publisherId))) {
      return NextResponse.json({ error: "That background picture doesn't belong to this account." }, { status: 400 })
    }
```

In `deriveVideoSpecUpdate`, after building `spec` and before `safeParse`, add:

```ts
  if (changed('videoLength') && spec.storyboard) {
    spec.storyboard = { ...spec.storyboard, beats: fitToLength(spec.storyboard.beats, getDurationForLength(spec.length)) }
  }
```

- [ ] **Step 5: Run them to make sure they pass**

Run: `npm test -- "app/api/ads/projects/[id]"`. Expected: PASS, including the existing
tests.

- [ ] **Step 6: Commit**

```bash
git add "app/api/ads/projects/[id]/video/direct" "app/api/ads/projects/[id]/route.ts" "app/api/ads/projects/[id]/route.test.ts" lib/services/ads/videoAssets.ts
git commit -m "feat(video): Direct my ad route; storyboards save safely

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The `BookAd` composition

**Files:**
- Install: `@remotion/transitions@4.0.525`, exact version
- Create, all in `components/ads/remotion/`:

  | File | Contents |
  |---|---|
  | `layout.ts` | Pure layout helpers: `stageLayout`, `BOOK_RATIO`, `transitionFor`, `textSizeFor` |
  | `layout.test.ts` | Tests for `layout.ts` |
  | `Book3D.tsx` | The 3D book |
  | `BeatText.tsx` | Animated beat lines |
  | `layers.tsx` | `Backdrop`, `Particles`, `Grain`, `Vignette` |
  | `scenes.tsx` | One component per beat kind, plus `Scene` |
  | `BookAd.tsx` | The composition |

- Modify: `remotion/Root.tsx` (register `BookAd`)

**Interfaces:**
- Consumes from Task 1: `Storyboard`, `Beat`, `BeatOf`, `beatFrames`,
  `storyboardDurationInFrames`, `TRANSITION_FRAMES`, `fixedStoryboard`.
- Produces:
  - `BookAd` component with props `BookAdProps`:
    ```ts
    {
      spec: AdVideoSpec
      storyboard: Storyboard
      title: string
      author: string
      coverUrl: string | null
      pageUrls: (string | null)[] // index 0 is page 1
      settingUrl: string | null
      musicSrc?: string | null
    }
    ```
  - Remotion composition id `'BookAd'`, sized from `spec.format`, with duration from the
    storyboard.

- [ ] **Step 1: Install transitions and read the skill**

Run:
- `npm install --save-exact @remotion/transitions@4.0.525`
- `node -p "require('@remotion/transitions/package.json').version"`

Expected: `4.0.525`.

Read `.claude/skills/remotion-best-practices/remotion-markup/transitions.md`,
`timing.md` and `3d.md`. Ruling to record in the ledger: scenes live in one `scenes.tsx`
and the beats are mapped from data. That is the skill's "one source template" case: the
video is data-driven, not edited in Studio.

Two more rulings to record:
- No light-leak on the hook: it needs another package. Add
  `@remotion/light-leaks@4.0.525` in Task 8 only if the review finds the openings flat.
- The spine uses the cover-derived `theme.palette.bg` instead of sampling the cover's
  edge pixels.

- [ ] **Step 2: Write the failing layout tests** (`components/ads/remotion/layout.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { BOOK_RATIO, stageLayout, transitionFor, textSizeFor } from './layout'

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('stageLayout', () => {
  for (const [w, h] of [[1920, 1080], [1080, 1080], [1080, 1920]]) {
    for (const side of ['left', 'right'] as const) {
      it(`keeps text clear of the book at ${w}×${h}, text ${side}`, () => {
        const { book, text } = stageLayout(w, h, side)
        expect(overlap(book, text)).toBe(false)
        for (const box of [book, text]) {
          expect(box.x).toBeGreaterThanOrEqual(0)
          expect(box.y).toBeGreaterThanOrEqual(0)
          expect(box.x + box.w).toBeLessThanOrEqual(w)
          expect(box.y + box.h).toBeLessThanOrEqual(h)
        }
        expect(book.w / book.h).toBeCloseTo(BOOK_RATIO)
        expect(text.w).toBeGreaterThan(w * 0.3)
      })
    }
  }
})

describe('transitionFor', () => {
  it('slides into pages and fades into title and end cards', () => {
    expect(transitionFor('hook', 'pageZoom')).toBe('slide')
    expect(transitionFor('pageZoom', 'titleCard')).toBe('fade')
    expect(transitionFor('audience', 'endCard')).toBe('fade')
    expect(transitionFor('hook', 'audience')).toBe('wipe')
  })
})

describe('textSizeFor', () => {
  it('scales with the short side of the frame', () => {
    expect(textSizeFor(1920, 1080)).toBe(textSizeFor(1080, 1920))
    expect(textSizeFor(1920, 1080)).toBeGreaterThan(60)
  })
})
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npm test -- components/ads/remotion/layout.test.ts`
Expected: FAIL with `Failed to resolve import "./layout"`.

- [ ] **Step 4: Implement `layout.ts`**

```ts
import type { BeatKind } from '@/lib/services/ads/storyboard'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Width ÷ height of a typical book cover. */
export const BOOK_RATIO = 0.68

/** Where the book and the line sit when the text is on `side`; they never overlap. */
export function stageLayout(width: number, height: number, side: 'left' | 'right'): { book: Box; text: Box; stacked: boolean } {
  if (height > width) {
    const h = height * 0.4
    const w = h * BOOK_RATIO
    return {
      stacked: true,
      book: { x: (width - w) / 2, y: height * 0.1, w, h },
      text: { x: width * 0.08, y: height * 0.56, w: width * 0.84, h: height * 0.32 },
    }
  }
  const h = height * (width === height ? 0.56 : 0.66)
  const w = h * BOOK_RATIO
  const margin = width * 0.07
  const gap = width * 0.05
  const bookX = side === 'left' ? width - margin - w : margin
  const textX = side === 'left' ? margin : bookX + w + gap
  const textW = side === 'left' ? bookX - gap - margin : width - margin - textX
  return {
    stacked: false,
    book: { x: bookX, y: (height - h) / 2, w, h },
    text: { x: textX, y: height * 0.18, w: textW, h: height * 0.64 },
  }
}

export type TransitionKind = 'fade' | 'slide' | 'wipe'

export function transitionFor(_prev: BeatKind, next: BeatKind): TransitionKind {
  if (next === 'pageZoom' || next === 'bookOpen') return 'slide'
  if (next === 'titleCard' || next === 'endCard') return 'fade'
  return 'wipe'
}

/** Base size for a beat line; fitFontSize shrinks long lines from here. */
export const textSizeFor = (width: number, height: number) => Math.round(Math.min(width, height) * 0.078)
```

Run: `npm test -- components/ads/remotion/layout.test.ts`. Expected: PASS.

- [ ] **Step 5: Implement `Book3D.tsx`**

```tsx
import { Img } from 'remotion'
import { BOOK_RATIO } from './layout'

/**
 * The real cover as a book: spine, page edge, contact shadow. `open` (0–1) swings the cover
 * open on its spine to show `leftPageUrl` / `rightPageUrl`; the spread stays centred.
 */
export function Book3D({
  coverUrl,
  leftPageUrl = null,
  rightPageUrl = null,
  height,
  turn = 0,
  open = 0,
  spine,
  title,
}: {
  coverUrl: string | null
  leftPageUrl?: string | null
  rightPageUrl?: string | null
  height: number
  turn?: number
  open?: number
  spine: string
  title: string
}) {
  const width = height * BOOK_RATIO
  const depth = height * 0.055
  const shift = (width / 2) * open
  const paper = '#f6f1e6'
  const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', overflow: 'hidden' }
  const pageImg: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' }
  return (
    <div style={{ position: 'relative', width, height, perspective: height * 3.2 }}>
      <div
        style={{
          position: 'absolute',
          left: width * 0.08 - shift * 0.5,
          right: -width * 0.06 - shift * 1.5,
          bottom: -height * 0.05,
          height: height * 0.08,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%)',
          filter: `blur(${height * 0.02}px)`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateX(${shift}px) rotateY(${turn * (1 - open)}deg)` }}>
        <div style={{ ...face, background: paper, transform: `translateZ(${-depth}px)`, boxShadow: '0 30px 60px rgba(0,0,0,0.45)' }}>
          {rightPageUrl && <Img src={rightPageUrl} style={pageImg} />}
        </div>
        <div style={{ position: 'absolute', top: 0, left: -depth / 2, width: depth, height, background: spine, transform: `translateZ(${-depth / 2}px) rotateY(90deg)` }} />
        <div
          style={{
            position: 'absolute',
            top: height * 0.012,
            left: width - depth / 2,
            width: depth,
            height: height * 0.976,
            background: 'repeating-linear-gradient(90deg, #efe8d8 0 2px, #d6ceb9 2px 3px)',
            transform: `translateZ(${-depth / 2}px) rotateY(90deg)`,
          }}
        />
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transformOrigin: 'left center', transform: `rotateY(${-172 * open}deg)` }}>
          <div style={{ ...face, borderRadius: `${height * 0.004}px ${height * 0.01}px ${height * 0.01}px ${height * 0.004}px`, boxShadow: 'inset 8px 0 14px rgba(0,0,0,0.35)', background: spine }}>
            {coverUrl ? (
              <Img src={coverUrl} style={pageImg} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: width * 0.1, color: '#fff', fontSize: height * 0.06, fontWeight: 700, textAlign: 'center' }}>
                {title}
              </div>
            )}
          </div>
          <div style={{ ...face, background: paper, transform: 'rotateY(180deg)' }}>{leftPageUrl && <Img src={leftPageUrl} style={pageImg} />}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Implement `BeatText.tsx`**

```tsx
import { Easing, interpolate, useCurrentFrame } from 'remotion'
import { fitFontSize } from '@/components/trailer/remotion/fit'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Numbers in the accent colour: "120 cases" reads as proof at a glance. */
function withAccent(line: string, accent: string) {
  return line.split(/(\d[\d,.]*\+?)/).map((part, i) => (/^\d/.test(part) ? <span key={i} style={{ color: accent }}>{part}</span> : part))
}

/** Each line rises and fades in, a beat apart; everything fades out over the last 10 frames. */
export function BeatText({
  text,
  frames,
  font,
  color,
  accent,
  size,
  align = 'left',
  delay = 6,
  uppercase = false,
}: {
  text: string
  frames: number
  font: string
  color: string
  accent: string
  size: number
  align?: 'left' | 'center'
  delay?: number
  uppercase?: boolean
}) {
  const frame = useCurrentFrame()
  const lines = text.split('\n')
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), '')
  return (
    <div
      style={{
        fontFamily: font,
        color,
        fontSize: fitFontSize(size, longest, 18),
        fontWeight: 700,
        lineHeight: 1.12,
        textAlign: align,
        textTransform: uppercase ? 'uppercase' : undefined,
        letterSpacing: uppercase ? '0.04em' : undefined,
        textShadow: '0 2px 24px rgba(0,0,0,0.45)',
        opacity: interpolate(frame, [frames - 10, frames], [1, 0], clamp),
      }}
    >
      {lines.map((line, i) => {
        const start = delay + i * 7
        const p = interpolate(frame, [start, start + 16], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })
        return (
          <div key={i} style={{ opacity: p, translate: `0 ${(1 - p) * 30}px` }}>
            {withAccent(line, accent)}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: Implement `layers.tsx`**

```tsx
import { AbsoluteFill, Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Particle, StoryboardTheme } from '@/lib/services/ads/storyboard'

/** The setting (or a soft palette glow), pushing in slowly across the whole video. */
export function Backdrop({ settingUrl, palette }: { settingUrl: string | null; palette: StoryboardTheme['palette'] }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const scale = interpolate(frame, [0, durationInFrames], [1.02, 1.14])
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 68% 38%, ${palette.accent}40, ${palette.bg} 62%)` }}>
      {settingUrl && <Img src={settingUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', scale: String(scale) }} />}
      {settingUrl && <AbsoluteFill style={{ background: `${palette.bg}59` }} />}
    </AbsoluteFill>
  )
}

const COUNT: Record<Particle, number> = { leaves: 16, snow: 70, dust: 36, embers: 30, none: 0 }
const LEAF_COLOURS = ['#c2410c', '#d97706', '#b45309', '#9a3412', '#ca8a04']

/** Deterministic drifting particles; `random(seed)` keeps every render identical. */
export function Particles({ kind, accent }: { kind: Particle; accent: string }) {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const t = frame / fps
  const unit = Math.min(width, height)
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: COUNT[kind] }, (_, i) => {
        const r = (k: string) => random(`${kind}-${i}-${k}`)
        const falls = kind === 'leaves' || kind === 'snow'
        const speed = (kind === 'leaves' ? 0.09 : kind === 'snow' ? 0.07 : 0.025) * (0.6 + r('s') * 0.8)
        const p = (r('o') + t * speed) % 1
        const y = (falls ? -0.1 + p * 1.2 : 1.1 - p * 1.2) * height
        const x = (r('x') + Math.sin(t * (0.6 + r('w')) + i) * 0.025) * width
        const size = unit * (kind === 'leaves' ? 0.022 + r('z') * 0.018 : kind === 'snow' ? 0.004 + r('z') * 0.006 : 0.003 + r('z') * 0.005)
        const flicker = 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + i))
        const style: React.CSSProperties =
          kind === 'leaves'
            ? { width: size * 1.4, height: size, borderRadius: '60% 0', background: LEAF_COLOURS[i % LEAF_COLOURS.length], rotate: `${t * 70 * (r('d') > 0.5 ? 1 : -1) + r('a') * 360}deg`, opacity: 0.9 }
            : kind === 'snow'
              ? { width: size, height: size, borderRadius: '50%', background: '#fff', opacity: 0.85, filter: 'blur(1px)' }
              : kind === 'embers'
                ? { width: size, height: size, borderRadius: '50%', background: accent, opacity: flicker, boxShadow: `0 0 ${size * 3}px ${accent}` }
                : { width: size, height: size, borderRadius: '50%', background: '#fff8e7', opacity: flicker * 0.5, filter: 'blur(1.5px)' }
        return <div key={i} style={{ position: 'absolute', left: x, top: y, ...style }} />
      })}
    </AbsoluteFill>
  )
}

export function Vignette() {
  return <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)', pointerEvents: 'none' }} />
}

/** Film grain: SVG noise reseeded every other frame. */
export function Grain() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <svg width="100%" height="100%">
        <filter id="ad-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(frame / 2)} />
        </filter>
        <rect width="100%" height="100%" filter="url(#ad-grain)" />
      </svg>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 8: Implement `scenes.tsx`**

```tsx
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Beat, BeatOf, StoryboardTheme } from '@/lib/services/ads/storyboard'
import { Book3D } from './Book3D'
import { BeatText } from './BeatText'
import { stageLayout } from './layout'

export interface AdCtx {
  width: number
  height: number
  theme: StoryboardTheme
  font: string
  textSize: number
  coverUrl: string | null
  pageUrls: (string | null)[]
  title: string
}
interface SceneProps<K extends Beat['kind']> {
  beat: BeatOf<K>
  frames: number
  ctx: AdCtx
}
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.bezier(0.45, 0, 0.55, 1)

/** Book on one side, the line on the other: hook, proof and audience share it. */
function BookAndLine({ side, text, frames, ctx, pageUrl }: { side: 'left' | 'right'; text: string; frames: number; ctx: AdCtx; pageUrl?: string | null }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { book, text: box, stacked } = stageLayout(ctx.width, ctx.height, side)
  const enter = spring({ frame, fps, config: { damping: 200 } })
  const turn = interpolate(frame, [0, frames], [16, 6]) * (side === 'left' ? -1 : 1)
  const float = Math.sin(frame / 20) * ctx.height * 0.006
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: book.x, top: book.y + float + (1 - enter) * ctx.height * 0.04, opacity: enter }}>
        {pageUrl ? (
          <Img src={pageUrl} style={{ height: book.h, width: book.w, objectFit: 'cover', rotate: `${side === 'left' ? 3 : -3}deg`, boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }} />
        ) : (
          <Book3D coverUrl={ctx.coverUrl} height={book.h} turn={turn} spine={ctx.theme.palette.bg} title={ctx.title} />
        )}
      </div>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, display: 'flex', alignItems: 'center', justifyContent: stacked ? 'center' : 'flex-start' }}>
        <BeatText text={text} frames={frames} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.accent} size={ctx.textSize} align={stacked ? 'center' : 'left'} />
      </div>
    </AbsoluteFill>
  )
}

export function HookScene({ beat, frames, ctx }: SceneProps<'hook'>) {
  return <BookAndLine side={beat.side} text={beat.text} frames={frames} ctx={ctx} />
}

export function ProofScene({ beat, frames, ctx }: SceneProps<'proof'>) {
  return <BookAndLine side="left" text={beat.text} frames={frames} ctx={ctx} pageUrl={beat.page ? ctx.pageUrls[beat.page - 1] : null} />
}

export function AudienceScene({ beat, frames, ctx }: SceneProps<'audience'>) {
  return <BookAndLine side="right" text={beat.text} frames={frames} ctx={ctx} />
}

/** A trailer card: dark, one sentence, the cover pinned small in the corner when asked. */
export function TitleCardScene({ beat, frames, ctx }: SceneProps<'titleCard'>) {
  const frame = useCurrentFrame()
  const dark = interpolate(frame, [0, 8], [0.4, 0.86], clamp)
  return (
    <AbsoluteFill style={{ background: `rgba(8,8,10,${dark})`, alignItems: 'center', justifyContent: 'center', padding: ctx.width * 0.1 }}>
      {ctx.theme.cornerCover && ctx.coverUrl && (
        <Img src={ctx.coverUrl} style={{ position: 'absolute', left: ctx.width * 0.03, top: ctx.height * 0.04, height: ctx.height * 0.16, boxShadow: '0 8px 20px rgba(0,0,0,0.6)' }} />
      )}
      <BeatText text={beat.text} frames={frames} font={ctx.font} color="#f5f1e8" accent={ctx.theme.palette.accent} size={ctx.textSize * 0.78} align="center" />
    </AbsoluteFill>
  )
}

/** The page fills the frame; the camera moves in on the part that proves the caption. */
export function PageZoomScene({ beat, frames, ctx }: SceneProps<'pageZoom'>) {
  const frame = useCurrentFrame()
  const url = ctx.pageUrls[beat.page - 1]
  if (!url) return <BookAndLine side="left" text={beat.text ?? ctx.title} frames={frames} ctx={ctx} />
  const progress = interpolate(frame, [0, frames], [0, 1], { ...clamp, easing: ease })
  const scale = 1 + (beat.focus.zoom - 1) * progress
  const portrait = ctx.height > ctx.width
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle, ${ctx.theme.palette.bg}e6, ${ctx.theme.palette.bg})`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Img
        src={url}
        style={{
          ...(portrait ? { width: ctx.width * 0.92 } : { height: ctx.height * 0.94 }),
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          transformOrigin: `${beat.focus.x * 100}% ${beat.focus.y * 100}%`,
          scale: String(scale),
        }}
      />
      {beat.text && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: `${ctx.height * 0.035}px ${ctx.width * 0.06}px`, background: `${ctx.theme.palette.bg}e6`, display: 'flex', justifyContent: 'center' }}>
          <BeatText text={beat.text} frames={frames} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.accent} size={ctx.textSize * 0.55} align="center" uppercase />
        </div>
      )}
    </AbsoluteFill>
  )
}

/** The book swings open on two real pages, then the camera eases in. */
export function BookOpenScene({ beat, frames, ctx }: SceneProps<'bookOpen'>) {
  const frame = useCurrentFrame()
  const portrait = ctx.height > ctx.width
  const h = ctx.height * (portrait ? 0.34 : 0.7)
  const w = h * 0.68
  const open = interpolate(frame, [8, frames * 0.5], [0, 1], { ...clamp, easing: ease })
  const push = interpolate(frame, [0, frames], [1, 1.08], clamp)
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', left: ctx.width / 2 - w / 2 - (w / 2) * open, top: (ctx.height - h) / 2 - (beat.text ? ctx.height * 0.05 : 0), scale: String(push) }}>
        <Book3D coverUrl={ctx.coverUrl} height={h} turn={-12} open={open} spine={ctx.theme.palette.bg} title={ctx.title} leftPageUrl={ctx.pageUrls[beat.page - 1] ?? null} rightPageUrl={ctx.pageUrls[beat.page] ?? null} />
      </div>
      {beat.text && (
        <div style={{ position: 'absolute', left: ctx.width * 0.08, right: ctx.width * 0.08, bottom: ctx.height * 0.06, display: 'flex', justifyContent: 'center' }}>
          <BeatText text={beat.text} frames={frames} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.accent} size={ctx.textSize * 0.6} align="center" delay={Math.round(frames * 0.4)} />
        </div>
      )}
    </AbsoluteFill>
  )
}

/** Cover, title, series line and the button; the last frames match the opening so it loops. */
export function EndCardScene({ beat, frames, ctx }: SceneProps<'endCard'>) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { book, text: box, stacked } = stageLayout(ctx.width, ctx.height, 'right')
  const pop = spring({ frame: frame - 16, fps, config: { damping: 12, stiffness: 120 } })
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: book.x, top: book.y }}>
        <Book3D coverUrl={ctx.coverUrl} height={book.h} turn={interpolate(frame, [0, frames], [10, 4])} spine={ctx.theme.palette.bg} title={ctx.title} />
      </div>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: stacked ? 'center' : 'flex-start', gap: ctx.height * 0.025 }}>
        <BeatText text={beat.title} frames={frames + 30} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.ink} size={ctx.textSize * 0.82} align={stacked ? 'center' : 'left'} delay={4} />
        {beat.subtitle && (
          <BeatText text={beat.subtitle} frames={frames + 30} font={ctx.font} color={ctx.theme.palette.ink} accent={ctx.theme.palette.accent} size={ctx.textSize * 0.4} align={stacked ? 'center' : 'left'} delay={10} />
        )}
        <div style={{ scale: String(Math.max(0, pop)), fontFamily: ctx.font, fontWeight: 700, fontSize: ctx.textSize * 0.42, color: ctx.theme.palette.bg, background: ctx.theme.palette.accent, padding: `${ctx.textSize * 0.22}px ${ctx.textSize * 0.55}px`, borderRadius: 999, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
          {beat.cta}
        </div>
      </div>
    </AbsoluteFill>
  )
}

export function Scene({ beat, frames, ctx }: { beat: Beat; frames: number; ctx: AdCtx }) {
  switch (beat.kind) {
    case 'hook':
      return <HookScene beat={beat} frames={frames} ctx={ctx} />
    case 'titleCard':
      return <TitleCardScene beat={beat} frames={frames} ctx={ctx} />
    case 'pageZoom':
      return <PageZoomScene beat={beat} frames={frames} ctx={ctx} />
    case 'bookOpen':
      return <BookOpenScene beat={beat} frames={frames} ctx={ctx} />
    case 'proof':
      return <ProofScene beat={beat} frames={frames} ctx={ctx} />
    case 'audience':
      return <AudienceScene beat={beat} frames={frames} ctx={ctx} />
    case 'endCard':
      return <EndCardScene beat={beat} frames={frames} ctx={ctx} />
  }
}
```

- [ ] **Step 9: Implement `BookAd.tsx`**

```tsx
'use client'
import { AbsoluteFill, Audio, interpolate, useVideoConfig } from 'remotion'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { slide } from '@remotion/transitions/slide'
import { wipe } from '@remotion/transitions/wipe'
import { TRANSITION_FRAMES, beatFrames, type Storyboard } from '@/lib/services/ads/storyboard'
import type { AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { adFontFamily } from '@/components/trailer/remotion/fonts'
import { Backdrop, Grain, Particles, Vignette } from './layers'
import { Scene, type AdCtx } from './scenes'
import { textSizeFor, transitionFor } from './layout'

export interface BookAdProps {
  [key: string]: unknown
  spec: AdVideoSpec
  storyboard: Storyboard
  title: string
  author: string
  coverUrl: string | null
  /** Index 0 is page 1; pages the storyboard does not show may be null. */
  pageUrls: (string | null)[]
  settingUrl: string | null
  musicSrc?: string | null
}

const PRESENTATIONS = {
  fade: fade(),
  slide: slide({ direction: 'from-right' }),
  wipe: wipe({ direction: 'from-left' }),
}

export function BookAd({ storyboard, title, coverUrl, pageUrls, settingUrl, musicSrc }: BookAdProps) {
  const { width, height, fps, durationInFrames } = useVideoConfig()
  const { theme, beats } = storyboard
  const ctx: AdCtx = { width, height, theme, font: adFontFamily(theme.font), textSize: textSizeFor(width, height), coverUrl, pageUrls, title }
  const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES })
  return (
    <AbsoluteFill style={{ background: theme.palette.bg }}>
      <Backdrop settingUrl={settingUrl} palette={theme.palette} />
      <TransitionSeries>
        {beats.flatMap((beat, i) => {
          const sequence = (
            <TransitionSeries.Sequence key={`beat-${i}`} name={beat.kind} durationInFrames={beatFrames(beat)} premountFor={fps}>
              <Scene beat={beat} frames={beatFrames(beat)} ctx={ctx} />
            </TransitionSeries.Sequence>
          )
          if (i === 0) return [sequence]
          return [
            <TransitionSeries.Transition key={`cut-${i}`} presentation={PRESENTATIONS[transitionFor(beats[i - 1].kind, beat.kind)]} timing={timing} />,
            sequence,
          ]
        })}
      </TransitionSeries>
      <Particles kind={theme.particles} accent={theme.palette.accent} />
      <Vignette />
      <Grain />
      {musicSrc && (
        <Audio
          src={musicSrc}
          loop
          volume={(f) => interpolate(f, [0, fps / 2, durationInFrames - fps, durationInFrames], [0, 0.8, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </AbsoluteFill>
  )
}
```

- [ ] **Step 10: Register it in `remotion/Root.tsx`**

Add these imports:

```tsx
import { BookAd, type BookAdProps } from '../components/ads/remotion/BookAd'
import { fixedStoryboard, storyboardDurationInFrames } from '../lib/services/ads/storyboard'
import { presetStyle } from '../lib/services/ads/videoSpec'

const bookAdDefaults: BookAdProps = {
  spec: defaults.spec,
  storyboard: fixedStoryboard({ title: 'Preview', pageCount: 0, cta: 'Get your copy', lengthSec: 15, style: presetStyle('cinematic') }),
  title: 'Preview',
  author: '',
  coverUrl: null,
  pageUrls: [],
  settingUrl: null,
}
```

Add inside the fragment:

```tsx
      <Composition
        id="BookAd"
        component={BookAd}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={storyboardDurationInFrames(bookAdDefaults.storyboard.beats)}
        defaultProps={bookAdDefaults}
        calculateMetadata={({ props }) => ({
          ...videoDimensions(props.spec.format),
          durationInFrames: storyboardDurationInFrames(props.storyboard.beats),
        })}
      />
```

- [ ] **Step 11: Typecheck, bundle and render one still per beat kind**

Run:
- `npx tsc --noEmit`, expected no output
- `npm run remotion:bundle`, expected "Remotion bundle written to …/.remotion-bundle"

Create `scripts/render-beat-stills.mjs`, a dev check that is committed:

```js
// Renders one still from the middle of every beat of a sample storyboard, for a quick look.
//   npm run remotion:bundle && node scripts/render-beat-stills.mjs [outDir]
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { createJiti } from 'jiti'
import { renderStill, selectComposition, ensureBrowser } from '@remotion/renderer'

const root = process.cwd()
const jiti = createJiti(import.meta.url, { alias: { '@': root } })
const { fixedStoryboard, beatStartFrames, beatFrames } = await jiti.import('./lib/services/ads/storyboard.ts')
const { presetStyle, defaultVideoSpec } = await jiti.import('./lib/services/ads/videoSpec.ts')
const out = process.argv[2] ?? path.join(root, 'test-results', 'beat-stills')
mkdirSync(out, { recursive: true })

const storyboard = fixedStoryboard({ title: 'Murder at Thornwick Mill', blurb: 'A murder mystery told in 120 word searches.', bullets: ['For fans of cosy crime'], pageCount: 0, cta: 'Get your copy', lengthSec: 20, style: presetStyle('cinematic') })
for (const format of ['16:9', '1:1', '9:16']) {
  const inputProps = { spec: { ...defaultVideoSpec({ title: 'T' }), format }, storyboard, title: 'Murder at Thornwick Mill', author: '', coverUrl: null, pageUrls: [], settingUrl: null }
  await ensureBrowser()
  const serveUrl = path.join(root, '.remotion-bundle')
  const composition = await selectComposition({ serveUrl, id: 'BookAd', inputProps })
  const starts = beatStartFrames(storyboard.beats)
  for (const [i, beat] of storyboard.beats.entries()) {
    const frame = starts[i] + Math.floor(beatFrames(beat) / 2)
    await renderStill({ composition, serveUrl, inputProps, frame, output: path.join(out, `${format.replace(':', 'x')}-${i}-${beat.kind}.png`) })
  }
}
console.log(`stills written to ${out}`)
```

Run: `node scripts/render-beat-stills.mjs`. Expected: "stills written to …".

Open three of the stills (16:9 hook, 9:16 hook, 16:9 endCard). They must show:
- a placeholder book with the title
- readable text clear of the book
- no blank frame

Fix any crash before committing.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json components/ads/remotion remotion/Root.tsx scripts/render-beat-stills.mjs
git commit -m "feat(video): BookAd composition with 3D book, page zooms and transitions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Render ads with `BookAd` (instant export and campaign generation)

**Files:**
- Modify: `lib/services/ads/videoAssets.ts`. Replace `adVideoImages` with `bookAdImages`.
- Test: `lib/services/ads/videoAssets.test.ts`
- Modify: `app/api/ads/projects/[id]/video/instant/route.ts` and its test
- Modify: `app/api/ads/projects/[id]/generate/route.ts` and its test

**Interfaces:**
- Consumes from Tasks 1 and 5: `resolveStoryboard`, `pagesUsed`, `ownsStoredFile`,
  `settingsPath`, and the composition id `'BookAd'`.
- Produces:
  - `bookAdImages(book, storyboard, publisherId): Promise<{ coverUrl: string | null; pageUrls: (string | null)[]; settingUrl: string | null }>`
  - Inlines only the pages the storyboard shows; reads the setting only if this
    publisher owns it.

- [ ] **Step 1: Write the failing tests**

In `lib/services/ads/videoAssets.test.ts`, replace the `adVideoImages` describe with the
following. Keep that file's existing `readStoredFile` mock: it returns `{ data, contentType }`
for any URL.

```ts
describe('bookAdImages', () => {
  const style = presetStyle('cinematic')
  const book = { frontCoverUrl: '/api/files/c.png', interiorImageUrls: ['/p1', '/p2', '/p3', '/p4'] }
  it('inlines the cover, only the pages the storyboard shows, and the owned setting', async () => {
    const storyboard = {
      ...fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style }),
      beats: [
        { kind: 'pageZoom' as const, page: 3, focus: { x: 0.5, y: 0.5, zoom: 1.5 }, seconds: 3 },
        { kind: 'endCard' as const, title: 'T', cta: 'Go', seconds: 3 },
      ],
    }
    storyboard.theme = { ...storyboard.theme, settingImageUrl: '/api/files/ads/pub_1/settings/s.png' }
    const out = await bookAdImages(book, storyboard, 'pub_1')
    expect(out.coverUrl).toMatch(/^data:/)
    expect(out.pageUrls.map(Boolean)).toEqual([false, false, true, false])
    expect(out.settingUrl).toMatch(/^data:/)
  })
  it('never reads a setting picture another publisher owns', async () => {
    const storyboard = fixedStoryboard({ title: 'T', pageCount: 0, cta: 'Go', lengthSec: 15, style })
    storyboard.theme = { ...storyboard.theme, settingImageUrl: '/api/files/ads/pub_2/settings/s.png' }
    expect((await bookAdImages(book, storyboard, 'pub_1')).settingUrl).toBeNull()
  })
})
```

In the instant route test, change the `videoAssets` mock to
`bookAdImages: vi.fn().mockResolvedValue({ coverUrl: 'data:cover', pageUrls: [], settingUrl: null })`.
Then add:

```ts
  it('renders the BookAd composition with the book’s storyboard', async () => {
    await POST(req(), ctx)
    const [props, compositionId] = vi.mocked(renderAdVideo).mock.calls[0]
    expect(compositionId).toBe('BookAd')
    expect((props as any).storyboard.beats.at(-1).kind).toBe('endCard')
    expect((props as any).coverUrl).toBe('data:cover')
  })
```

In `app/api/ads/projects/[id]/generate/route.test.ts`, update its `videoAssets` mock the
same way, and assert that the video render call uses `'BookAd'`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `npm test -- lib/services/ads/videoAssets.test.ts "app/api/ads/projects/[id]/video/instant" "app/api/ads/projects/[id]/generate"`
Expected: FAIL. `bookAdImages` is not exported, and the render is called without
`'BookAd'`.

- [ ] **Step 3: Implement**

In `videoAssets.ts`, delete `adVideoImages` and add:

```ts
import { ownsStoredFile, pagesUsed, settingsPath, type Storyboard } from './storyboard'

/** Everything BookAd draws, inline for headless Chrome; pages the storyboard doesn't show stay null. */
export async function bookAdImages(
  book: { frontCoverUrl: string | null; interiorImageUrls: string[] },
  storyboard: Storyboard,
  publisherId: string
) {
  const used = new Set(pagesUsed(storyboard))
  const setting = storyboard.theme.settingImageUrl
  const [coverUrl, settingUrl, ...pageUrls] = await Promise.all([
    inlineImage(book.frontCoverUrl),
    setting && ownsStoredFile(setting, settingsPath(publisherId)) ? inlineImage(setting) : Promise.resolve(null),
    ...book.interiorImageUrls.map((url, i) => (used.has(i + 1) ? inlineImage(url) : Promise.resolve(null))),
  ])
  return { coverUrl, settingUrl, pageUrls }
}
```

In the instant route, import `resolveStoryboard` from `@/lib/services/ads/storyboard` and
`bookAdImages` instead of `adVideoImages`, then replace the `renderAdVideo({...})` call
with:

```ts
        const storyboard = resolveStoryboard(spec, book)
        const video = await renderAdVideo(
          {
            spec,
            storyboard,
            title: book.title ?? 'Untitled book',
            author: book.author ?? '',
            musicSrc: await inlineMusic(resolveMusic(spec), publisherId),
            ...(await bookAdImages(book, storyboard, publisherId)),
          },
          'BookAd'
        )
```

In the generate route, make the same change inside the `goalWantsVideo` block, using
`details.title || 'Untitled book'` and `details.author` as that block does today.

- [ ] **Step 4: Run them to make sure they pass, then run the whole suite**

Run: `npm test`. Expected: all pass. Run `npx tsc --noEmit`: no output.

- [ ] **Step 5: Commit**

```bash
git add lib/services/ads/videoAssets.ts lib/services/ads/videoAssets.test.ts "app/api/ads/projects/[id]/video/instant" "app/api/ads/projects/[id]/generate"
git commit -m "feat(video): exports render the BookAd storyboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The video card: Direct my ad, beat editor, matching preview

**Files:**
- Create: `components/ads/BookAdPlayer.tsx`
- Modify: `components/ads/InstantVideoCard.tsx` (rewrite)
- Modify: `app/(platform)/ads/[projectId]/results/page.tsx` (props)
- Modify: `e2e/ads-instant-video.spec.ts`

**Interfaces:**
- Consumes:
  - from Task 4: `POST /video/direct`
  - from Task 5: `BookAd`
  - from Task 1: `fitToLength`, `beatStartFrames`, `storyboardDurationInFrames`,
    `resolveStoryboard`, `STORYBOARD_LIMITS`
- Produces: the props
  `InstantVideoCard({ projectId, title, author, coverUrl, pageUrls, pageCount, initialSpec, directed, video })`.
  `initialSpec.storyboard` is always set.

- [ ] **Step 1: Update the e2e first (it is skipped unless `E2E_ADS_PROJECT_ID` is set)**

In `e2e/ads-instant-video.spec.ts`:
- use `const card = page.getByRole('region', { name: 'Video ad' })`
- replace the hook block with:

```ts
    const first = card.getByLabel('Scene 1 text')
    await first.fill('A brand new opening line')
    await card.getByRole('button', { name: '1. Opening line' }).click()
    await expect(card).toContainText('A brand new opening line')
```

Keep the overflow, clipping, column and music checks.

Run: `E2E_ADS_PROJECT_ID=<a generated project id from the dev DB> npx playwright test e2e/ads-instant-video.spec.ts`
Expected: FAIL. There is no "Video ad" region yet.

- [ ] **Step 2: Implement `BookAdPlayer.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { Film, RotateCcw } from 'lucide-react'
import { BookAd, type BookAdProps } from '@/components/ads/remotion/BookAd'
import { beatStartFrames, storyboardDurationInFrames } from '@/lib/services/ads/storyboard'
import { FPS, musicUrl, resolveMusic, videoDimensions } from '@/lib/services/ads/videoSpec'

export const BEAT_LABELS = {
  hook: 'Opening line',
  titleCard: 'Title card',
  pageZoom: 'Page close-up',
  bookOpen: 'Book opens',
  proof: 'Proof',
  audience: 'Who it’s for',
  endCard: 'End card',
} as const

const STAGE_MAX_WIDTH = { '9:16': 300 } as Record<string, number>

/** The same BookAd composition the export renders, so the preview is the video. */
export function BookAdPlayer(props: Omit<BookAdProps, 'musicSrc'>) {
  const [mounted, setMounted] = useState(false)
  const ref = useRef<PlayerRef>(null)
  useEffect(() => setMounted(true), [])
  const { width, height } = videoDimensions(props.spec.format)
  const beats = props.storyboard.beats
  const starts = beatStartFrames(beats)
  const seek = (frame: number) => {
    ref.current?.seekTo(frame)
    ref.current?.play()
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid place-items-center rounded-2xl bg-black p-3 sm:p-4">
        <div className="w-full" style={{ maxWidth: STAGE_MAX_WIDTH[props.spec.format], aspectRatio: `${width} / ${height}` }}>
          {mounted ? (
            <Player
              ref={ref}
              component={BookAd}
              inputProps={{ ...props, musicSrc: musicUrl(resolveMusic(props.spec)) }}
              durationInFrames={storyboardDurationInFrames(beats)}
              fps={FPS}
              compositionWidth={width}
              compositionHeight={height}
              style={{ width: '100%', height: '100%' }}
              controls
              loop
            />
          ) : (
            <div className="grid size-full place-items-center text-white/40">
              <Film className="size-8" aria-hidden />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {beats.map((beat, i) => (
          <button
            key={i}
            type="button"
            onClick={() => seek(starts[i] + 8)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-accent/50 hover:text-ink"
          >
            {i + 1}. {BEAT_LABELS[beat.kind]}
          </button>
        ))}
        <button type="button" onClick={() => seek(0)} className="ml-auto inline-flex items-center gap-1 text-xs text-ink-muted transition hover:text-ink">
          <RotateCcw className="size-3" aria-hidden /> Replay
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `InstantVideoCard.tsx`**

Keep these unchanged from today's file:
- `save()` (PATCH `{ videoSpec }`)
- `exportVideo()`
- `uploadMusic()` and the music fieldset
- the Download/Save/Export header buttons
- the font buttons
- the format select

Changes:

1. **Props:**
   ```ts
   {
     projectId: string
     title: string
     author: string
     coverUrl: string | null
     pageUrls: string[]
     pageCount: number
     initialSpec: AdVideoSpec & { storyboard: Storyboard }
     directed: boolean
     video: …
   }
   ```
2. **Heading:** `<h3 id="instant-video-title">Video ad</h3>`, with the subtitle "AI looks
   at your cover and pages and plans each scene. Edit any scene below."
3. **State helpers:**
   ```ts
   const storyboard = spec.storyboard!
   const setBeats = (fn: (b: Beat[]) => Beat[]) =>
     setSpec((s) => ({ ...s, storyboard: { ...s.storyboard!, beats: fn(s.storyboard!.beats) } }))
   const setTheme = (patch: Partial<StoryboardTheme>) =>
     setSpec((s) => ({ ...s, storyboard: { ...s.storyboard!, theme: { ...s.storyboard!.theme, ...patch } } }))
   ```
4. **Direct block, above the preview:**

   ```tsx
   async function direct(revise: boolean) {
     if (dirty && !(await save())) return
     setDirecting(true)
     try {
       const res = await fetch(`/api/ads/projects/${projectId}/video/direct`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ revise, instruction: instruction.trim() || undefined }),
       })
       const json = await res.json().catch(() => ({}))
       if (!res.ok) return void toast.error(json.error ?? 'We couldn’t plan your ad.')
       setSpec(json.spec)
       setSaved(json.spec)
       setInstruction('')
       setDirected(true)
       if (json.source === 'fallback') toast.warning('The AI was busy, so we used a simple plan. Try again in a moment.')
       else toast.success('Your ad is planned. Press play to watch it.')
     } catch {
       toast.error('We couldn’t plan your ad.', { description: 'Check your connection and try again.' })
     } finally {
       setDirecting(false)
     }
   }
   ```

   - Not directed: a callout with a "Direct my ad" button (`Sparkles` icon) and one
     sentence: "It looks at your cover and pages, then writes the scenes."
   - Directed: an input labelled "What should change?" (max 400) and a "Change it"
     button calling `direct(true)`, plus a small "Start over" link calling
     `direct(false)`.
   - Both buttons are `loading={directing}`.
5. **Preview:**
   ```tsx
   <BookAdPlayer
     spec={spec}
     storyboard={storyboard}
     title={title}
     author={author}
     coverUrl={coverUrl}
     pageUrls={pageUrls}
     settingUrl={storyboard.theme.settingImageUrl}
   />
   ```
6. **Scene list** (`order-2`), replacing the hook/story/benefits/CTA fields. For each beat
   `i` there is a row:
   - the title `{i + 1}. {BEAT_LABELS[beat.kind]}`
   - up / down / remove icon buttons, labelled `Move scene ${i + 1} up`, `… down`,
     `Remove scene ${i + 1}`
     - All three are disabled for the end card.
     - Remove is disabled when there are only 2 beats.
     - Moving never passes the end card.
   - for every kind but `endCard`: a `<textarea rows={2} aria-label={`Scene ${i + 1} text`}>`
     bound to `beat.text ?? ''`, with a `Counter` against `STORYBOARD_LIMITS.text`
     - On change, set `text`; an empty value on `pageZoom`/`bookOpen` deletes the key.
   - for `endCard`: inputs labelled `End card title`, `End card subtitle` and
     `Button text`
   - for `pageZoom`, `bookOpen` and `proof`: a `<select aria-label={`Scene ${i + 1} page`}>`
     with `Page 1…Page {pageCount}`
     - `proof` also offers `Cover` (value `''`, which deletes `page`).
   - `<input type="number" step={0.5} min={2 or 3 for endCard} max={4} aria-label={`Scene ${i + 1} seconds`}>`
     bound to `beat.seconds`
7. **Length select:** onChange sets `length` and
   `storyboard.beats = fitToLength(storyboard.beats, getDurationForLength(next))`.
8. **Colours fieldset:**
   - The preset chips set both `style: presetStyle(key)` and
     `setTheme({ palette: { bg: p.colors.bgTo, ink: p.colors.text, accent: p.colors.accent }, font: p.font })`.
   - Three colour fields, `Background`/`Text`/`Highlight`, bound to
     `storyboard.theme.palette.bg/ink/accent`.
   - The font buttons call `setTheme({ font })`.
9. **Particles select** (`aria-label="Effects"`): Falling leaves, Snow, Dust in the light,
   Embers, None. It is bound to `theme.particles`.
10. **Remove** `COLOR_FIELDS`, the `SCRIPT_LIMITS` usage and the old script setters.
    `problem` and `dirty` stay as they are: `adVideoSpecSchema` now validates the
    storyboard too.

In the results page, pass these props:

```ts
const storyboard = resolveStoryboard(videoSpec, book)
// <InstantVideoCard … pageUrls={book.interiorImageUrls} pageCount={Math.min(book.interiorImageUrls.length, 6)}
//   initialSpec={{ ...videoSpec, storyboard }} directed={Boolean(videoSpec.storyboard)} … />
```

Remove the `interiorImageUrls` prop.

- [ ] **Step 4: Run e2e and checks**

Run:
- `npx tsc --noEmit`, expected no output
- `npm test`, expected all pass

Stop the dev server, then run:
- `E2E_ADS_PROJECT_ID=<id> DATABASE_URL=… npx playwright test e2e/ads-instant-video.spec.ts e2e/ads.spec.ts e2e/credits.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ads/BookAdPlayer.tsx components/ads/InstantVideoCard.tsx "app/(platform)/ads/[projectId]/results/page.tsx" e2e/ads-instant-video.spec.ts
git commit -m "feat(video): Direct my ad, scene editor and a preview that matches the export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Real ads against the references (quality loop)

**Files:**
- Create: `scripts/render-sample-ad.mjs`
- Modify: any `components/ads/remotion/*` or `adDirector.ts` prompt wording the review
  shows needs it

**Interfaces:**
- Consumes everything above. The script never writes to the database.

- [ ] **Step 1: Write the sample script**

```js
// Renders a real ad for a book in the dev database and a contact sheet of its frames.
//   npm run remotion:bundle
//   DATABASE_URL=… node scripts/render-sample-ad.mjs <bookId> [--direct] [--format 16:9] [--out dir]
// --direct asks the AI director (costs a few cents) and draws the setting; otherwise the fixed storyboard.
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createJiti } from 'jiti'

const root = process.cwd()
if (!process.env.OPENROUTER_API_KEY) process.loadEnvFile(path.join(root, '.env.local'))
const args = process.argv.slice(2)
const bookId = args[0]
const flag = (name) => args.includes(name)
const value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
if (!bookId) throw new Error('Usage: node scripts/render-sample-ad.mjs <bookId> [--direct] [--format 16:9] [--out dir]')

const jiti = createJiti(import.meta.url, { alias: { '@': root } })
const { prisma } = await jiti.import('./lib/db.ts')
const { readVideoSpec, bookVideoSource, resolveMusic } = await jiti.import('./lib/services/ads/videoSpec.ts')
const { resolveStoryboard } = await jiti.import('./lib/services/ads/storyboard.ts')
const { bookAdImages, inlineMusic, directorImages } = await jiti.import('./lib/services/ads/videoAssets.ts')
const { renderAdVideo } = await jiti.import('./lib/services/ads/renderVideo.ts')
const { getDurationForLength } = await jiti.import('./lib/services/trailer/options.ts')

const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId } })
const base = readVideoSpec(book.videoSpec, bookVideoSource(book))
const spec = { ...base, format: value('--format', base.format) }
let storyboard = resolveStoryboard(spec, book)
if (flag('--direct')) {
  const { directAd, drawSetting } = await jiti.import('./lib/services/ads/adDirector.ts')
  const result = await directAd(
    { title: book.title ?? 'Untitled book', author: book.author, blurb: book.blurb, bullets: book.bullets, categories: book.categories, pageCount: book.interiorImageUrls.length, cta: spec.script.cta, hook: book.customHook },
    await directorImages(book),
    { format: spec.format, lengthSec: getDurationForLength(spec.length), mood: spec.mood, style: spec.style }
  )
  const settingImageUrl = result.source === 'ai' ? await drawSetting(result.data.theme.settingPrompt, spec.format, book.publisherId) : null
  storyboard = { ...result.data, theme: { ...result.data.theme, settingImageUrl } }
  console.log(`director: ${result.source}${result.reason ? ` (${result.reason})` : ''}`)
}
const out = value('--out', path.join(root, 'test-results', 'sample-ads', `${bookId}-${spec.format.replace(':', 'x')}`))
mkdirSync(out, { recursive: true })
writeFileSync(path.join(out, 'storyboard.json'), JSON.stringify(storyboard, null, 2))

const video = await renderAdVideo(
  {
    spec,
    storyboard,
    title: book.title ?? 'Untitled book',
    author: book.author ?? '',
    musicSrc: await inlineMusic(resolveMusic(spec), book.publisherId),
    ...(await bookAdImages(book, storyboard, book.publisherId)),
  },
  'BookAd'
)
writeFileSync(path.join(out, 'ad.mp4'), video.videoBuffer)
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(out, 'ad.mp4'), '-vf', "fps=1/0.75,scale=400:-1,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=4x8", '-frames:v', '1', path.join(out, 'sheet.png')])
console.log(`ad: ${path.join(out, 'ad.mp4')} (${video.durationSec.toFixed(1)}s)\nsheet: ${path.join(out, 'sheet.png')}`)
await prisma.$disconnect()
```

- [ ] **Step 2: Pick two books and render**

Query the dev database for:
1. a puzzle or activity book with at least 2 inside pages
2. a story or children's book (with pages if possible)

If either is missing, promote a written book from Create a book, or add one through Add a
book with inside pages.

Run `npm run remotion:bundle`, then for each book:
- `node scripts/render-sample-ad.mjs <id> --direct`
- `node scripts/render-sample-ad.mjs <id> --direct --format 9:16`

Expected: four MP4s and four contact sheets, with `director: ai`.

- [ ] **Step 3: Review every sheet against the reference rules**

Open each `sheet.png` and `storyboard.json`. For each, write one ledger line per rule:
pass, or what is wrong.
1. The real cover is sharp, never redrawn.
2. Real pages are shown, and zooms land on meaningful parts.
3. One idea per beat, readable at a small size, never overlapping the book.
4. The order is hook → numbers → audience → title.
5. Something moves in every frame.
6. The setting fits the genre.
7. It reads with the sound off.
8. It loops cleanly.

Check also:
- that no number appears that isn't in the book's details or visible on its pages
- the no-cover and long-title cases: render one book with `frontCoverUrl` temporarily
  unset in a copy of the props, and one with a 70-character title

- [ ] **Step 4: Fix what fails, and re-render until every rule passes**

Fix, in this order:
- layout and timing in `components/ads/remotion/*`
- the director prompt wording in `adDirector.ts`

Keep its test assertions true. Re-render the affected sample after each fix.

- [ ] **Step 5: Run the full gate and commit**

Run:
- `npx tsc --noEmit`, expected no output
- `npm test`, expected all pass
- with the dev server stopped: `npx playwright test e2e/ads.spec.ts e2e/credits.spec.ts e2e/create-book.spec.ts`,
  expected pass

```bash
git add scripts/render-sample-ad.mjs components/ads/remotion lib/services/ads/adDirector.ts
git commit -m "feat(video): tune BookAd against the reference ads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Share two contact sheets (one puzzle book, one story book) with the publisher in the final
message, next to the matching reference sheets.
