# Ads Video Editor (Instant Video + AI Video) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Ads results page, let the publisher edit the video's words, font and colours with an instant live preview and export exactly that (green "Instant Video" card), and optionally generate an AI video from their cover and pages via an editable shot-by-shot prompt (cyan "Generate with AI").

**Architecture:** One zod-validated `AdVideoSpec` (script + style + format) drives a single Remotion composition that is played in the browser and rendered on the server from a prebuilt bundle (Remotion's bundler cannot run inside Next.js). The AI path writes an editable `AiVideoBrief`, submits one OpenRouter image-to-video job per shot, polls them, and stitches the clips with Remotion-rendered captions and end card using ffmpeg.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Prisma/Postgres, zod, Remotion 4.0.525 (`remotion`, `@remotion/player`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/google-fonts`), ffmpeg, OpenRouter (`/api/v1/videos`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-ads-video-editor-design.md`

## Global Constraints

- No engine names ("Remotion", "Hyperframes") in any user-visible text.
- Instant Video uses a light-green surface (`bg-instant-soft`, accents `instant`); AI Video uses cyan (`bg-ai-soft`, accents `ai`). Both have dark-mode values.
- Script limits: hook ≤ 60, story line ≤ 140, benefits ≤ 4 items of ≤ 28, CTA ≤ 28 characters.
- AI brief limits: 1–3 shots, prompt 10–600 chars, duration 3–10 s, caption ≤ 40; end card headline ≤ 48, CTA ≤ 28.
- All `@remotion/*` packages pinned to exactly `4.0.525` (same as `remotion`).
- Generate never makes an AI call for video text; AI is only called from the explicit AI buttons (banner ad copy generation is unchanged).
- Music: five bundled public-domain/CC0 tracks (one per mood) in `public/music/`, credited in `public/music/CREDITS.md`; the publisher can pick one, pick none, or upload their own MP3/WAV/M4A (≤ 15 MB). No AI music.
- Default video model `kwaivgi/kling-v3.0-std`; `OPENROUTER_VIDEO_MODEL` overrides it; the publisher's text-model setting never selects the video model.
- Images passed to headless Chrome or OpenRouter are data URIs (no session cookie is available to them).
- Commit identity: `git config user.name "Vijendrapratap"`, `git config user.email "44225657+Vijendrapratap@users.noreply.github.com"`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Unit tests: `npx vitest run <path>`. DB-backed `queries.test.ts` files need `DATABASE_URL` and are not part of this plan's checks.
- Env for Prisma CLI: prefix with `npx dotenv -e .env.local --` (Prisma reads `.env`, the app uses `.env.local`).

## File Structure

| File | Responsibility |
|---|---|
| `lib/services/ads/videoSpec.ts` (new) | `AdVideoSpec` schema, fonts list, presets, defaults, timing/dimension helpers. Pure; safe in client bundles. |
| `components/trailer/remotion/fonts.ts` (new) | Loads the 8 Google fonts through `@remotion/google-fonts`. |
| `components/trailer/remotion/fit.ts` (new) | `fitFontSize` — shrink long text instead of overflowing. |
| `components/trailer/remotion/BookTrailerComposition.tsx` (modify) | The ad video, driven by `spec`. |
| `components/trailer/remotion/AiAdParts.tsx` (new) | `AiCaption` still and `AiEndCard` composition for AI videos. |
| `components/trailer/TrailerLivePreviewPlayer.tsx` (rewrite) | Browser player for a spec. |
| `components/ads/InstantVideoCard.tsx` (new) | Green card: player + editor + save/export. |
| `components/ads/AiVideoPanel.tsx` (new) | Cyan panel: brief editor, AI write/revise, generate, progress. |
| `remotion/index.ts`, `remotion/Root.tsx` (new) | Remotion entry for the server bundle. |
| `scripts/remotion-bundle.mjs` (new) | Builds `.remotion-bundle/`. |
| `lib/services/ads/videoAssets.ts` (new) | Stored images → data URIs. |
| `lib/services/ads/renderVideo.ts` (new) | Server render of a composition/still from the bundle. |
| `lib/providers/aiVideo.ts` (new) | OpenRouter video API client + model capability helpers. Pure fetch; safe in client for the pure helpers. |
| `lib/services/ads/aiVideoBriefSchema.ts` (new) | Brief schema, prompt building, fallback. Pure. |
| `lib/services/ads/aiVideoBrief.ts` (new) | `generateAiVideoBrief` (calls the text model). Server only. |
| `lib/services/ads/aiVideoStitch.ts` (new) | ffmpeg stitch + probe. |
| `lib/services/ads/aiVideoJob.ts` (new) | Start/advance AI video jobs. |
| `app/api/ads/projects/[id]/video/instant/route.ts` (new) | Export Instant Video MP4. |
| `app/api/ads/projects/[id]/video/ai/brief/route.ts` (new) | Write/revise the AI brief. |
| `app/api/ads/projects/[id]/video/ai/route.ts` (new) | Start (POST) and poll (GET) AI video. |
| `app/api/ads/projects/[id]/generate/route.ts` (modify) | Initial video via `renderAdVideo`. |
| `app/(platform)/ads/[projectId]/results/page.tsx` (modify) | Video section on top; grid fix. |
| `components/ads/CreativeGallery.tsx` (modify) | Images only; responsive grid. |
| `components/ads/ConfigureForm.tsx` (modify) | Remove broken preview panel. |
| `components/trailer/TrailerConfigureForm.tsx` (modify) | Pass a spec to the player. |
| `lib/services/ads/options.ts` (modify) | PATCH schema: `videoSpec`; fix `videoLength` enum. |
| `lib/providers/ai.ts` (modify) | Video model default/env only. |
| `prisma/schema.prisma` + 2 migrations | `Book.videoSpec`, `Book.aiVideoBrief`, `AiVideoJob`. |
| `lib/services/trailer/video.ts` + test (delete) | Replaced by `renderAdVideo`. |

---

## Phase A — Instant Video (live editing)

### Task 1: `AdVideoSpec` module

**Files:**
- Create: `lib/services/ads/videoSpec.ts`
- Test: `lib/services/ads/videoSpec.test.ts`

**Interfaces:**
- Consumes: `STYLE_OPTIONS`, `getStyleSpec`, `getAspectRatioSpec`, `getDurationForLength`, `toTrailerStyle`, `toTrailerLength`, `toTrailerMusicMood`, `toTrailerAspectRatio`, `type TrailerStyle` from `lib/services/trailer/options.ts`.
- Produces: `AD_FONTS`, `type AdFontKey`, `SCRIPT_LIMITS`, `FPS` (30), `adVideoSpecSchema`, `type AdVideoSpec`, `presetStyle(preset)`, `clip(text, max)`, `type VideoSpecSource`, `defaultVideoSpec(source)`, `readVideoSpec(stored, source)`, `bookVideoSource(book)`, `videoDimensions(format)`, `videoDurationInFrames(spec)`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/services/ads/videoSpec.test.ts
import { describe, it, expect } from 'vitest'
import {
  SCRIPT_LIMITS,
  adVideoSpecSchema,
  bookVideoSource,
  clip,
  defaultVideoSpec,
  presetStyle,
  readVideoSpec,
  videoDimensions,
  videoDurationInFrames,
} from './videoSpec'

describe('defaultVideoSpec', () => {
  it('builds a valid spec from what the publisher typed, without AI', () => {
    const spec = defaultVideoSpec({
      title: 'Learning RAG',
      blurb: 'Build retrieval systems that work. From embeddings to evals. Third sentence here.',
      hook: '',
      cta: 'AVAILABLE NOW • GET YOUR COPY TODAY',
      style: 'scifi',
      format: '9:16',
      length: '15s',
      mood: 'epic',
    })
    expect(adVideoSpecSchema.safeParse(spec).success).toBe(true)
    expect(spec.script.hook).toBe('Learning RAG')
    expect(spec.script.storyLine).toBe('Build retrieval systems that work. From embeddings to evals.')
    expect(spec.script.benefits).toEqual([])
    expect(spec.script.cta.length).toBeLessThanOrEqual(SCRIPT_LIMITS.cta)
    expect(spec.style).toEqual(presetStyle('scifi'))
    expect(spec.format).toBe('9:16')
  })

  it('falls back to safe defaults for unknown stored values', () => {
    const spec = defaultVideoSpec({ style: 'nope', format: '4:3', length: '60s' })
    expect(spec.style.preset).toBe('cinematic')
    expect(spec.format).toBe('16:9')
    expect(spec.length).toBe('15s')
    expect(spec.script.hook.length).toBeGreaterThan(0)
    expect(adVideoSpecSchema.safeParse(spec).success).toBe(true)
  })
})

describe('clip', () => {
  it('cuts at a word boundary within the limit', () => {
    expect(clip('one two three four', 9)).toBe('one two')
  })
  it('collapses whitespace and leaves short text alone', () => {
    expect(clip('  short   text ', 20)).toBe('short text')
  })
})

describe('adVideoSpecSchema', () => {
  const valid = defaultVideoSpec({ title: 'T' })
  it('rejects text past the limits, bad colours and too many benefits', () => {
    expect(adVideoSpecSchema.safeParse({ ...valid, script: { ...valid.script, hook: 'x'.repeat(61) } }).success).toBe(false)
    expect(
      adVideoSpecSchema.safeParse({ ...valid, style: { ...valid.style, colors: { ...valid.style.colors, accent: 'red' } } }).success
    ).toBe(false)
    expect(
      adVideoSpecSchema.safeParse({ ...valid, script: { ...valid.script, benefits: ['a', 'b', 'c', 'd', 'e'] } }).success
    ).toBe(false)
  })
})

describe('readVideoSpec', () => {
  it('uses the stored spec when it validates and the default otherwise', () => {
    const stored = defaultVideoSpec({ title: 'Stored' })
    expect(readVideoSpec(stored, { title: 'Other' }).script.hook).toBe('Stored')
    expect(readVideoSpec({ junk: true }, { title: 'Other' }).script.hook).toBe('Other')
    expect(readVideoSpec(null, { title: 'Other' }).script.hook).toBe('Other')
  })
})

describe('bookVideoSource', () => {
  it('maps the ads project columns', () => {
    expect(
      bookVideoSource({
        title: 'T', blurb: 'B', customHook: 'H', ctaText: 'C',
        videoStyle: 'fantasy', videoFormat: '1:1', videoLength: '30s', videoMood: 'epic',
      })
    ).toEqual({ title: 'T', blurb: 'B', hook: 'H', cta: 'C', style: 'fantasy', format: '1:1', length: '30s', mood: 'epic' })
  })
})

describe('timing and size', () => {
  it('derives frames and pixels from the spec', () => {
    expect(videoDurationInFrames({ length: '15s' })).toBe(450)
    expect(videoDimensions('9:16')).toEqual({ width: 1080, height: 1920 })
    expect(videoDimensions('16:9')).toEqual({ width: 1920, height: 1080 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/ads/videoSpec.test.ts`
Expected: FAIL — `Failed to resolve import "./videoSpec"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/services/ads/videoSpec.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/services/ads/videoSpec.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/services/ads/videoSpec.ts lib/services/ads/videoSpec.test.ts
git commit -m "feat(ads): add AdVideoSpec — editable video script, font and colours

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Store the spec (DB column + PATCH)

**Files:**
- Modify: `prisma/schema.prisma` (model `Book`, after `videoLength`)
- Create: `prisma/migrations/20260923120000_ads_video_spec/migration.sql`
- Modify: `lib/services/ads/options.ts:228-248` (`projectUpdateSchema`)
- Test: `app/api/ads/projects/[id]/route.test.ts`

**Interfaces:**
- Consumes: `adVideoSpecSchema`, `defaultVideoSpec` from Task 1.
- Produces: `Book.videoSpec: Prisma.JsonValue | null`; `PATCH /api/ads/projects/:id` accepts `{ videoSpec: AdVideoSpec }`.

- [ ] **Step 1: Write the failing tests** — append inside the existing `describe('PATCH /api/ads/projects/:id', …)` block, and add the helper + import at the top of the file:

```ts
// top of app/api/ads/projects/[id]/route.test.ts, after the other imports
import { defaultVideoSpec } from '@/lib/services/ads/videoSpec'

const jsonRequest = (body: unknown) =>
  new Request('http://localhost/api/ads/projects/book_1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
```

```ts
  it('saves an edited video spec', async () => {
    const spec = defaultVideoSpec({ title: 'T' })
    const res = await PATCH(jsonRequest({ videoSpec: spec }), ctx('book_1'))
    expect(res.status).toBe(200)
    expect(prisma.book.update).toHaveBeenCalledWith({ where: { id: 'book_1' }, data: { videoSpec: spec } })
  })

  it('rejects a video spec with an invalid colour', async () => {
    const spec = defaultVideoSpec({ title: 'T' })
    spec.style.colors.accent = 'red'
    const res = await PATCH(jsonRequest({ videoSpec: spec }), ctx('book_1'))
    expect(res.status).toBe(400)
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('accepts every length the configure form offers', async () => {
    const res = await PATCH(jsonRequest({ videoLength: '20s' }), ctx('book_1'))
    expect(res.status).toBe(200)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run "app/api/ads/projects/[id]/route.test.ts"`
Expected: FAIL — the spec test gets 400 "Unrecognized"/200 without `videoSpec` in data; the `20s` test gets 400.

- [ ] **Step 3: Implement**

`prisma/schema.prisma`, in `model Book` directly after the `videoLength` line:

```prisma
  videoSpec         Json?
```

`prisma/migrations/20260923120000_ads_video_spec/migration.sql`:

```sql
-- The Instant Video editor stores the publisher's script, font and colours.
ALTER TABLE "Book" ADD COLUMN "videoSpec" JSONB;
```

`lib/services/ads/options.ts` — add the import at the top and change two lines of `projectUpdateSchema`:

```ts
import { adVideoSpecSchema } from './videoSpec'
```

```ts
    videoLength: z.enum(['6s', '15s', '20s', '30s']).optional(),
    videoSpec: adVideoSpecSchema,
```

(`videoLength` previously listed `'15s', '30s', '60s'`, so the configure form's 6 s and 20 s choices failed to save.)

Apply and regenerate the client:

```bash
npx dotenv -e .env.local -- prisma migrate deploy
npx prisma generate
```

Expected: `1 migration applied` (`20260923120000_ads_video_spec`), then `Generated Prisma Client`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run "app/api/ads/projects/[id]/route.test.ts" && npx tsc --noEmit`
Expected: PASS; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260923120000_ads_video_spec lib/services/ads/options.ts "app/api/ads/projects/[id]/route.test.ts"
git commit -m "feat(ads): persist the video spec; accept 6s/20s video lengths

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Spec-driven composition, fonts and preview player

**Files:**
- Create: `components/trailer/remotion/fonts.ts`, `components/trailer/remotion/fit.ts`, `components/trailer/remotion/fit.test.ts`
- Modify: `components/trailer/remotion/BookTrailerComposition.tsx`
- Rewrite: `components/trailer/TrailerLivePreviewPlayer.tsx`
- Modify: `components/trailer/TrailerConfigureForm.tsx:203-215`, `components/ads/ConfigureForm.tsx` (remove preview), `package.json` (dependency)

**Interfaces:**
- Consumes: `AdVideoSpec`, `AdFontKey`, `FPS`, `defaultVideoSpec`, `videoDimensions`, `videoDurationInFrames` (Task 1).
- Produces:
  - `adFontFamily(key: AdFontKey): string`
  - `fitFontSize(base: number, text: string, comfortableChars: number, floor?: number): number`
  - `BookTrailerCompositionProps = { spec: AdVideoSpec; title: string; author: string; coverUrl?: string | null; interiorImageUrls?: string[] }` and `BookTrailerComposition`
  - `TrailerLivePreviewPlayer({ spec, title, author, coverUrl?, interiorImageUrls?, className? })`

- [ ] **Step 1: Install the fonts package**

```bash
npm install --save-exact @remotion/google-fonts@4.0.525
```

Expected: `added N packages`; `package.json` lists `"@remotion/google-fonts": "4.0.525"`.

- [ ] **Step 2: Write the failing test for `fitFontSize`**

```ts
// components/trailer/remotion/fit.test.ts
import { describe, it, expect } from 'vitest'
import { fitFontSize } from './fit'

describe('fitFontSize', () => {
  it('keeps the base size for text that fits comfortably', () => {
    expect(fitFontSize(72, 'short', 20)).toBe(72)
  })
  it('shrinks long text by the square root of the overflow', () => {
    expect(fitFontSize(100, 'x'.repeat(40), 20)).toBe(71)
  })
  it('never shrinks below the floor', () => {
    expect(fitFontSize(72, 'x'.repeat(80), 20)).toBe(40)
  })
})
```

Run: `npx vitest run components/trailer/remotion/fit.test.ts`
Expected: FAIL — cannot resolve `./fit`.

- [ ] **Step 3: Implement `fit.ts` and `fonts.ts`**

```ts
// components/trailer/remotion/fit.ts
/** Shrinks long text instead of letting it overflow the frame; never below `floor` × base. */
export function fitFontSize(base: number, text: string, comfortableChars: number, floor = 0.55): number {
  const length = text.trim().length
  if (length <= comfortableChars) return Math.round(base)
  return Math.round(base * Math.max(floor, Math.sqrt(comfortableChars / length)))
}
```

```ts
// components/trailer/remotion/fonts.ts
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadLora } from '@remotion/google-fonts/Lora'
import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel'
import { loadFont as loadMerriweather } from '@remotion/google-fonts/Merriweather'
import { loadFont as loadCaveat } from '@remotion/google-fonts/Caveat'
import type { AdFontKey } from '@/lib/services/ads/videoSpec'

// Only the weights the scenes use: every weight of eight families would stall
// the first frame while they download.
const LOADERS: Record<AdFontKey, () => { fontFamily: string }> = {
  inter: () => loadInter('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }),
  montserrat: () => loadMontserrat('normal', { weights: ['400', '600', '700'], subsets: ['latin'] }),
  bebas: () => loadBebas('normal', { weights: ['400'], subsets: ['latin'] }),
  playfair: () => loadPlayfair('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  lora: () => loadLora('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  cinzel: () => loadCinzel('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  merriweather: () => loadMerriweather('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  caveat: () => loadCaveat('normal', { weights: ['400', '700'], subsets: ['latin'] }),
}

const loaded = new Map<AdFontKey, string>()

/** Loads a font once and returns its CSS family. Remotion holds rendering until it is ready. */
export function adFontFamily(key: AdFontKey): string {
  let family = loaded.get(key)
  if (!family) {
    family = (LOADERS[key] ?? LOADERS.inter)().fontFamily
    loaded.set(key, family)
  }
  return `${family}, sans-serif`
}
```

If `tsc` later reports a weight that a family does not offer, remove that weight from its array (the loader's type lists the valid ones).

Run: `npx vitest run components/trailer/remotion/fit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Drive the composition from the spec**

In `components/trailer/remotion/BookTrailerComposition.tsx` make these edits:

1. Imports — replace lines 1–16 with:

```tsx
'use client'
import React from 'react'
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion'
import type { TrailerStyle } from '@/lib/services/trailer/options'
import type { AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { adFontFamily } from './fonts'
import { fitFontSize } from './fit'
```

2. Replace the `BookTrailerCompositionProps` interface and the whole `const PALETTES: Record<TrailerStyle, Palette> = { … }` object with:

```tsx
export interface BookTrailerCompositionProps {
  [key: string]: unknown
  spec: AdVideoSpec
  title: string
  author: string
  coverUrl?: string | null
  interiorImageUrls?: string[]
}

interface Palette {
  bgGradient: [string, string, string]
  accent: string
  textPrimary: string
  textSecondary: string
  fontFamily: string
}

function paletteFromSpec(spec: AdVideoSpec): Palette {
  const { bgFrom, bgTo, accent, text } = spec.style.colors
  return {
    bgGradient: [bgFrom, bgTo, bgTo],
    accent,
    textPrimary: text,
    textSecondary: `${text}cc`,
    fontFamily: adFontFamily(spec.style.font),
  }
}
```

3. `Scene1`: rename the prop `hookText?: string | null` to `hook: string`, set `const mainHook = hook`, and size the hook text with `fontSize: fitFontSize(Math.max(32, Math.round(72 * scale)), mainHook, 28),` (replacing the existing `fontSize` of that block).

4. `Scene2`: rename the prop `blurb: string` to `storyLine: string`; replace the `cleanBlurb` computation with `const cleanBlurb = storyLine`; in the quote-glyph block replace `fontFamily: 'Georgia, serif',` with `fontFamily: palette.fontFamily,`; in the text block use `fontSize: fitFontSize(Math.max(18, Math.round(40 * scale)), cleanBlurb, 90),`.

5. `Scene3`: add the prop `benefits: string[]`; add `height` to the destructure `const { fps, height } = useVideoConfig()`; after the `bookRotateY` line add

```tsx
  // Sized from the frame, not a fixed 630px: in a square frame a fixed cover
  // plus the title column ran past the bottom edge.
  const coverH = Math.round(height * (isWidescreen ? 0.6 : 0.4))
  const coverW = Math.round((coverH * 2) / 3)
```

replace every `isWidescreen ? 360 * scale : 420 * scale` with `coverW` and every `isWidescreen ? 540 * scale : 630 * scale` with `coverH`; replace every `<img` with `<Img` (and drop the `eslint-disable` comment lines above them); size the title with `fontSize: fitFontSize(Math.max(26, Math.round(54 * scale)), title || 'Untitled Book', 24),`; and after the author `<div>` in the details column add:

```tsx
        {benefits.length > 0 && (
          <div
            style={{
              marginTop: Math.max(14, 26 * scale),
              display: 'flex',
              flexWrap: 'wrap',
              gap: Math.max(6, 12 * scale),
              justifyContent: isWidescreen ? 'flex-start' : 'center',
            }}
          >
            {benefits.map((benefit, i) => {
              const shown = spring({ frame: Math.max(0, frame - 12 - i * 6), fps, config: { damping: 14 } })
              return (
                <div key={i} style={{ opacity: shown, transform: `translateY(${interpolate(shown, [0, 1], [12, 0])}px)` }}>
                  <PillBadge text={benefit} accent={palette.accent} scale={scale * 0.9} />
                </div>
              )
            })}
          </div>
        )}
```

6. `Scene2`: replace its `<img` with `<Img` (drop the eslint comment).

7. `Scene4`: rename `ctaText?: string | null` to `cta: string`, set `const ctaHeadline = cta`, delete the `platforms` array and the whole "Retailer badges" block (it claimed availability at stores the book may not be in).

8. Rename `HyperframeLightingSweep` to `LightSweep`, give it a `sceneFrames: number` prop and use `const beat = frame % sceneFrames`.

9. Replace the exported `BookTrailerComposition` function with:

```tsx
export function BookTrailerComposition({ spec, title, author, coverUrl, interiorImageUrls }: BookTrailerCompositionProps) {
  const { durationInFrames, width, height } = useVideoConfig()
  const palette = paletteFromSpec(spec)
  const scale = Math.min(width, height) / 1080
  // Square frames use the side-by-side layout too; stacked, they overflow.
  const isWidescreen = width >= height
  const sceneFrames = Math.floor(durationInFrames / 4)
  const lastFrames = durationInFrames - sceneFrames * 3

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AnimatedBackground palette={palette} style={spec.style.preset as TrailerStyle} scale={scale} />
      <LightSweep scale={scale} sceneFrames={sceneFrames} />

      <Sequence from={0} durationInFrames={sceneFrames}>
        <Scene1 title={title} author={author} hook={spec.script.hook} palette={palette} style={spec.style.preset} scale={scale} durationInFrames={sceneFrames} />
      </Sequence>

      <Sequence from={sceneFrames} durationInFrames={sceneFrames}>
        <Scene2
          storyLine={spec.script.storyLine || title}
          author={author}
          palette={palette}
          scale={scale}
          durationInFrames={sceneFrames}
          isWidescreen={isWidescreen}
          interiorImageUrl={interiorImageUrls?.[0]}
        />
      </Sequence>

      <Sequence from={sceneFrames * 2} durationInFrames={sceneFrames}>
        <Scene3
          title={title}
          author={author}
          coverUrl={coverUrl}
          benefits={spec.script.benefits}
          palette={palette}
          scale={scale}
          durationInFrames={sceneFrames}
          isWidescreen={isWidescreen}
          interiorImageUrl={interiorImageUrls?.[1] || interiorImageUrls?.[0]}
        />
      </Sequence>

      <Sequence from={sceneFrames * 3} durationInFrames={lastFrames}>
        <Scene4 cta={spec.script.cta} title={title} palette={palette} scale={scale} durationInFrames={lastFrames} />
      </Sequence>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 5: Rewrite the preview player**

Replace the whole of `components/trailer/TrailerLivePreviewPlayer.tsx` with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { Film, RotateCcw } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import {
  BookTrailerComposition,
  type BookTrailerCompositionProps,
} from './remotion/BookTrailerComposition'
import { FPS, videoDimensions, videoDurationInFrames, type AdVideoSpec } from '@/lib/services/ads/videoSpec'

export interface TrailerLivePreviewPlayerProps {
  spec: AdVideoSpec
  title: string
  author: string
  coverUrl?: string | null
  interiorImageUrls?: string[]
  className?: string
}

const SCENES = ['Hook', 'Story', 'Book', 'Call to action']

/** Stage width per format, so a vertical video is not blown up to the column width. */
const STAGE_MAX_WIDTH: Record<AdVideoSpec['format'], number> = { '9:16': 300, '1:1': 460, '16:9': 680 }

export function TrailerLivePreviewPlayer({ spec, title, author, coverUrl, interiorImageUrls, className }: TrailerLivePreviewPlayerProps) {
  const [mounted, setMounted] = useState(false)
  const playerRef = useRef<PlayerRef>(null)
  useEffect(() => setMounted(true), [])

  const { width, height } = videoDimensions(spec.format)
  const durationInFrames = videoDurationInFrames(spec)
  const sceneFrames = Math.floor(durationInFrames / SCENES.length)
  const inputProps: BookTrailerCompositionProps = { spec, title, author, coverUrl, interiorImageUrls }

  const seek = (frame: number) => {
    playerRef.current?.seekTo(frame)
    playerRef.current?.play()
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="grid place-items-center rounded-2xl bg-black p-3 sm:p-4">
        <div className="w-full" style={{ maxWidth: STAGE_MAX_WIDTH[spec.format], aspectRatio: `${width} / ${height}` }}>
          {mounted ? (
            <Player<any, BookTrailerCompositionProps>
              ref={playerRef}
              component={BookTrailerComposition}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
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
        {SCENES.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => seek(i * sceneFrames)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-accent/50 hover:text-ink"
          >
            {i + 1}. {name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => seek(0)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-ink-muted transition hover:text-ink"
        >
          <RotateCcw className="size-3" aria-hidden /> Replay
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Update the two callers**

`components/trailer/TrailerConfigureForm.tsx` — add `import { defaultVideoSpec } from '@/lib/services/ads/videoSpec'` and replace the `<TrailerLivePreviewPlayer … />` element (and its `{/* Interactive Remotion Live Preview */}` comment) with:

```tsx
      <TrailerLivePreviewPlayer
        spec={defaultVideoSpec({
          title: book.title,
          blurb: book.blurb,
          hook: hookText,
          cta: ctaText,
          style,
          format: aspectRatios[0] ?? '9:16',
          length,
          mood: musicMood,
        })}
        title={book.title}
        author={book.author}
        coverUrl={book.coverUrl}
        interiorImageUrls={book.interiorImageUrls}
      />
```

`components/ads/ConfigureForm.tsx` — the video is now edited on the results page, so:
- delete the import line `import { TrailerLivePreviewPlayer } from '@/components/trailer/TrailerLivePreviewPlayer'`;
- change `<div className="grid gap-6 xl:grid-cols-[1fr_24rem]">` (inside `{includeVideo && (`) to `<div className="flex flex-col gap-6">`;
- delete the whole `{/* Live preview */}` `<div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4 shadow-inset">…</div>` block;
- change the `{/* Amazon Video Trailer & Hyperframes Motion Suite */}` comment to `{/* Video ad settings */}`.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npx vitest run components/trailer lib/services/ads/videoSpec.test.ts`
Expected: tsc prints nothing; tests PASS.

Then open `http://localhost:3000/trailer` → any project → configure, and `http://localhost:3000/ads/<id>/configure`, and confirm: the trailer preview plays with the new text scenes, the ads configure page has no preview panel, and neither page shows a console error.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json components/trailer components/ads/ConfigureForm.tsx
git commit -m "feat(video): drive the ad composition from AdVideoSpec with Google fonts

- Fonts load through @remotion/google-fonts so frames wait for them
- Cover sized from the frame; square uses the side-by-side layout
- Long text shrinks to fit; benefits appear as chips on the book beat
- Retailer badges removed (they claimed stores the book may not be in)
- Remove the broken preview panel from the ads configure page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Instant Video card and results page layout

**Files:**
- Modify: `app/globals.css` (tokens)
- Create: `components/ads/InstantVideoCard.tsx`
- Modify: `app/(platform)/ads/[projectId]/results/page.tsx`, `components/ads/CreativeGallery.tsx`
- Test: `e2e/ads-instant-video.spec.ts` (Playwright)

**Interfaces:**
- Consumes: Task 1 exports; `TrailerLivePreviewPlayer` (Task 3); `PATCH /api/ads/projects/:id` with `videoSpec` (Task 2); `adFontFamily` (Task 3).
- Produces: `InstantVideoCard(props: InstantVideoCardProps)` where
  `InstantVideoCardProps = { projectId: string; title: string; author: string; coverUrl: string | null; interiorImageUrls: string[]; initialSpec: AdVideoSpec; video: { videoUrl: string | null; videoPosterUrl: string | null; videoDuration: number | null } }`.
  Colour utilities `bg-instant`, `bg-instant-soft`, `text-instant`, `border-instant`, `bg-ai`, `bg-ai-soft`, `text-ai`, `border-ai`.

- [ ] **Step 1: Add colour tokens**

In `app/globals.css`, inside `@theme { … }` directly after `--color-tint-create-book: …;` add:

```css
  --color-instant: oklch(0.47 0.11 152);
  --color-instant-soft: oklch(0.93 0.05 152);
  --color-ai: oklch(0.5 0.11 220);
  --color-ai-soft: oklch(0.93 0.045 220);
```

and inside `.dark { … }` directly after its `--color-tint-create-book: …;` add:

```css
  --color-instant: oklch(0.8 0.13 152);
  --color-instant-soft: oklch(0.28 0.045 152);
  --color-ai: oklch(0.8 0.11 220);
  --color-ai-soft: oklch(0.28 0.045 220);
```

- [ ] **Step 2: Write the failing end-to-end test**

Check `playwright.config.ts` for `testDir` and `baseURL` and place the file in that directory (examples below assume `e2e/` and `baseURL: http://localhost:3000`).

```ts
// e2e/ads-instant-video.spec.ts
import { test, expect } from '@playwright/test'

// Needs an ads project that has been generated at least once.
const PROJECT = process.env.E2E_ADS_PROJECT_ID

test.skip(!PROJECT, 'Set E2E_ADS_PROJECT_ID to a generated ads project')

for (const width of [1440, 1024]) {
  test(`results page fits at ${width}px and the hook edits the preview`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/ads/${PROJECT}/results`)
    const card = page.getByRole('region', { name: 'Instant Video' })
    await expect(card).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    const hook = card.getByLabel('Hook')
    await hook.fill('A brand new hook line')
    await card.getByRole('button', { name: '1. Hook' }).click()
    // Input values are not text content, so this only matches the player's frame.
    await expect(card).toContainText('A brand new hook line')
    await expect(card.getByRole('button', { name: 'Save' })).toBeEnabled()
    await expect(page.getByText(/remotion|hyperframe/i)).toHaveCount(0)
  })
}
```

Run: `E2E_ADS_PROJECT_ID=cmud6xbkz0001ias68l1q7el8 npx playwright test e2e/ads-instant-video.spec.ts --project=chromium`
Expected: FAIL — no region named "Instant Video". (If the config has no `chromium` project, drop `--project`.)

- [ ] **Step 3: Create the card**

```tsx
// components/ads/InstantVideoCard.tsx
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, Plus, Save, X, Zap } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { TrailerLivePreviewPlayer } from '@/components/trailer/TrailerLivePreviewPlayer'
import { adFontFamily } from '@/components/trailer/remotion/fonts'
import {
  AD_FONTS,
  SCRIPT_LIMITS,
  adVideoSpecSchema,
  presetStyle,
  type AdFontKey,
  type AdVideoSpec,
} from '@/lib/services/ads/videoSpec'
import { ASPECT_RATIO_OPTIONS, LENGTH_OPTIONS, STYLE_OPTIONS } from '@/lib/services/trailer/options'

export interface InstantVideoCardProps {
  projectId: string
  title: string
  author: string
  coverUrl: string | null
  interiorImageUrls: string[]
  initialSpec: AdVideoSpec
  video: { videoUrl: string | null; videoPosterUrl: string | null; videoDuration: number | null }
}

const COLOR_FIELDS = [
  { key: 'bgFrom', label: 'Background' },
  { key: 'bgTo', label: 'Background 2' },
  { key: 'accent', label: 'Accent' },
  { key: 'text', label: 'Text' },
] as const

const HEX = /^#[0-9a-f]{6}$/i
const inputClass =
  'w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-instant focus:ring-2 focus:ring-instant/25'
const labelClass = 'flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted'

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('text-[11px] font-normal normal-case tabular-nums', value.length > max ? 'font-semibold text-danger' : 'text-ink-muted')}>
      {value.length}/{max}
    </span>
  )
}

export function InstantVideoCard({ projectId, title, author, coverUrl, interiorImageUrls, initialSpec, video }: InstantVideoCardProps) {
  const [spec, setSpec] = useState(initialSpec)
  const [saved, setSaved] = useState(initialSpec)
  const [saving, setSaving] = useState(false)
  const [fontFamilies, setFontFamilies] = useState<Partial<Record<AdFontKey, string>>>({})

  // Loaded after mount: the font loader needs `document`.
  useEffect(() => {
    setFontFamilies(Object.fromEntries(AD_FONTS.map((f) => [f.key, adFontFamily(f.key)])))
  }, [])

  const dirty = JSON.stringify(spec) !== JSON.stringify(saved)
  const check = adVideoSpecSchema.safeParse(spec)
  const problem = check.success ? null : check.error.issues[0]?.message ?? 'Check the video text'

  const setScript = (patch: Partial<AdVideoSpec['script']>) => setSpec((s) => ({ ...s, script: { ...s.script, ...patch } }))
  const setColors = (patch: Partial<AdVideoSpec['style']['colors']>) =>
    setSpec((s) => ({ ...s, style: { ...s.style, colors: { ...s.style.colors, ...patch } } }))

  async function save(): Promise<boolean> {
    if (!check.success) {
      toast.error(problem ?? 'Check the video text')
      return false
    }
    setSaving(true)
    const res = await fetch(`/api/ads/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoSpec: check.data }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'We couldn’t save your video.')
      return false
    }
    setSaved(check.data)
    setSpec(check.data)
    toast.success('Video saved')
    return true
  }

  return (
    <section aria-labelledby="instant-video-title" className="rounded-3xl border border-instant/30 bg-instant-soft p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-instant text-canvas">
            <Zap className="size-5" aria-hidden />
          </span>
          <div>
            <h3 id="instant-video-title" className="font-display text-lg font-semibold text-ink">Instant Video</h3>
            <p className="text-sm text-ink-muted">Edit the words, font and colours. The preview updates as you type.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {video.videoUrl && (
            <a href={video.videoUrl} download="video-ad.mp4" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              <Download className="size-3.5" aria-hidden /> Download MP4
            </a>
          )}
          <Button type="button" size="sm" onClick={save} loading={saving} disabled={!dirty || saving} className="bg-instant text-canvas hover:bg-instant/90">
            <Save className="size-3.5" aria-hidden /> Save
          </Button>
        </div>
      </header>

      {problem && dirty && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{problem}</p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <TrailerLivePreviewPlayer spec={spec} title={title} author={author} coverUrl={coverUrl} interiorImageUrls={interiorImageUrls} />

        <div className="flex min-w-0 flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Hook <Counter value={spec.script.hook} max={SCRIPT_LIMITS.hook} /></span>
            <input className={inputClass} value={spec.script.hook} onChange={(e) => setScript({ hook: e.target.value })} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Story line <Counter value={spec.script.storyLine} max={SCRIPT_LIMITS.storyLine} /></span>
            <textarea rows={2} className={inputClass} value={spec.script.storyLine} onChange={(e) => setScript({ storyLine: e.target.value })} />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Benefits <span className="font-normal normal-case">up to {SCRIPT_LIMITS.benefits}</span></span>
            {spec.script.benefits.map((benefit, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Benefit ${i + 1}`}
                  className={inputClass}
                  value={benefit}
                  onChange={(e) => setScript({ benefits: spec.script.benefits.map((b, j) => (j === i ? e.target.value : b)) })}
                />
                <Counter value={benefit} max={SCRIPT_LIMITS.benefit} />
                <button
                  type="button"
                  aria-label={`Remove benefit ${i + 1}`}
                  onClick={() => setScript({ benefits: spec.script.benefits.filter((_, j) => j !== i) })}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-surface hover:text-danger"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            {spec.script.benefits.length < SCRIPT_LIMITS.benefits && (
              <button
                type="button"
                onClick={() => setScript({ benefits: [...spec.script.benefits, ''] })}
                className="inline-flex items-center gap-1 self-start text-sm font-medium text-instant hover:underline"
              >
                <Plus className="size-3.5" aria-hidden /> Add a benefit
              </button>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Call to action <Counter value={spec.script.cta} max={SCRIPT_LIMITS.cta} /></span>
            <input className={inputClass} value={spec.script.cta} onChange={(e) => setScript({ cta: e.target.value })} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Format</span>
              <select className={inputClass} value={spec.format} onChange={(e) => setSpec((s) => ({ ...s, format: e.target.value as AdVideoSpec['format'] }))}>
                {ASPECT_RATIO_OPTIONS.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Length</span>
              <select className={inputClass} value={spec.length} onChange={(e) => setSpec((s) => ({ ...s, length: e.target.value as AdVideoSpec['length'] }))}>
                {LENGTH_OPTIONS.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className={labelClass}>Font</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AD_FONTS.map((font) => {
                const selected = spec.style.font === font.key
                return (
                  <button
                    key={font.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSpec((s) => ({ ...s, style: { ...s.style, font: font.key } }))}
                    style={{ fontFamily: fontFamilies[font.key] }}
                    className={cn(
                      'truncate rounded-xl border px-2 py-2 text-sm text-ink transition',
                      selected ? 'border-instant bg-surface ring-2 ring-instant/30' : 'border-line bg-surface/60 hover:border-instant/50'
                    )}
                  >
                    {font.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Colours</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {STYLE_OPTIONS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setSpec((s) => ({ ...s, style: presetStyle(preset.key) }))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink transition hover:border-instant/50"
                >
                  <span className="size-3 rounded-full" style={{ background: preset.palette.accent }} aria-hidden />
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COLOR_FIELDS.map((field) => {
                const value = spec.style.colors[field.key]
                return (
                  <label key={field.key} className="flex min-w-0 flex-col gap-1 text-xs text-ink-muted">
                    {field.label}
                    <span className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5">
                      <input
                        type="color"
                        aria-label={`${field.label} colour`}
                        value={HEX.test(value) ? value : '#000000'}
                        onChange={(e) => setColors({ [field.key]: e.target.value })}
                        className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <input
                        aria-label={`${field.label} hex`}
                        value={value}
                        onChange={(e) => setColors({ [field.key]: e.target.value })}
                        className="w-full min-w-0 bg-transparent font-mono text-xs text-ink outline-none"
                      />
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Put the video on top of the results page and fix the grid**

`app/(platform)/ads/[projectId]/results/page.tsx`:

```tsx
// add imports
import { InstantVideoCard } from '@/components/ads/InstantVideoCard'
import { bookVideoSource, readVideoSpec } from '@/lib/services/ads/videoSpec'
```

After the `trailerMissing` constant add `const videoSpec = readVideoSpec(book.videoSpec, bookVideoSource(book))`. Directly after the `{trailerMissing && ( … )}` block add:

```tsx
      {book.includeVideo !== false && (
        <InstantVideoCard
          projectId={book.id}
          title={book.title ?? 'Untitled book'}
          author={book.author ?? ''}
          coverUrl={book.frontCoverUrl}
          interiorImageUrls={book.interiorImageUrls}
          initialSpec={videoSpec}
          video={{ videoUrl: set.videoUrl, videoPosterUrl: set.videoPosterUrl, videoDuration: set.videoDuration }}
        />
      )}
```

and remove the `video={{ … }}` prop from `<CreativeGallery …>`.

`components/ads/CreativeGallery.tsx`:
- delete `video?: { … } | null` from `CreativeGalleryProps` and `video,` from the destructure;
- delete `const hasVideo = …`, the `'video'` member of the filter state type and its branch in `displayedImages`, the "Video Trailer" tab button, and the whole `{/* Video Trailer Card … */}` block;
- change the "All Assets" label to `All Assets ({images.length})`;
- replace `<ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">` with `<ul className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">` and the wide-card class `isWide ? 'sm:col-span-2 xl:col-span-3' : ''` with `isWide ? 'col-span-full' : ''`;
- remove now-unused icon imports (`Film`, `Tv`, `Sparkles`, `Check` if unused).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && E2E_ADS_PROJECT_ID=cmud6xbkz0001ias68l1q7el8 npx playwright test e2e/ads-instant-video.spec.ts`
Expected: tsc prints nothing; both viewport tests PASS.

Screenshot the results page at 1440 px in light and dark mode and look at them: green card on top, player beside the editor, image cards with full "Download" labels.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/ads/InstantVideoCard.tsx components/ads/CreativeGallery.tsx "app/(platform)/ads/[projectId]/results/page.tsx" e2e/ads-instant-video.spec.ts
git commit -m "feat(ads): Instant Video card with live text, font and colour editing

The results page leads with the video; image cards use a responsive grid so
their actions are never clipped.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4b: Music — bundled library, picker, upload, and playback

**Files:**
- Create: `public/music/{suspenseful,epic,ambient,upbeat,emotional}.mp3`, `public/music/CREDITS.md`
- Modify: `lib/services/ads/videoSpec.ts`, `lib/services/ads/videoSpec.test.ts`, `lib/services/shared/upload.ts:38-47`
- Modify: `components/trailer/remotion/BookTrailerComposition.tsx`, `components/trailer/TrailerLivePreviewPlayer.tsx`, `components/ads/InstantVideoCard.tsx`
- Create: `app/api/ads/projects/[id]/music/route.ts`, `app/api/ads/projects/[id]/music/route.test.ts`

**Interfaces:**
- Consumes: Task 1–4 exports; `storeFile`; `assetPath`.
- Produces:
  - `MUSIC_TRACKS` (`{ key, label, composer, file }[]`, keys equal the mood keys), `type MusicTrackKey`
  - `musicSchema` and `AdVideoSpec['music']` (optional): `{ kind: 'none' } | { kind: 'library'; track: MusicTrackKey } | { kind: 'upload'; url: string; name: string }`
  - `resolveMusic(spec): NonNullable<AdVideoSpec['music']>` — the saved choice, or the library track for `spec.mood`
  - `musicUrl(music): string | null` — browser URL (`/music/<key>.mp3` or the upload URL)
  - `BookTrailerCompositionProps.musicSrc?: string | null`
  - `POST /api/ads/projects/:id/music` (multipart field `file`) → `201 { url, name }` | `400 { error }` | `404`

- [ ] **Step 1: Add the tracks**

All five are on Wikimedia Commons with machine-readable licences (checked 2026-09-23). Download, trim to 60 s, fade and loudness-match them:

```bash
mkdir -p public/music && cd public/music
ua='PublisherToolkit/1.0 (music bundle)'
get() { curl -sL -A "$ua" -o "src-$1" "$2"; }
get suspenseful.ogg 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Musopen_-_In_the_Hall_Of_The_Mountain_King.ogg'
get epic.ogg 'https://upload.wikimedia.org/wikipedia/commons/2/29/Richard_Wagner_-_Ride_of_the_Valkyries.ogg'
get ambient.ogg 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Gymnopedie_No._1..ogg'
get upbeat.mp3 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Scott_Joplin_-_04_-_The_Entertainer_1902_piano_roll.mp3'
get emotional.flac 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Satie_Gymnopedie_No_2_performed_by_Michael_Laucke.flac'
for f in src-*; do
  key="${f#src-}"; key="${key%.*}"
  ffmpeg -y -loglevel error -i "$f" -t 60 -ac 2 -ar 44100 \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.5,afade=t=out:st=57:d=3" -b:a 128k "$key.mp3"
done
rm src-*; ls -la; cd ../..
```

Expected: five `.mp3` files of roughly 1 MB. Listen to the first seconds of each (`ffplay -autoexit -t 8 public/music/epic.mp3`) — if a track opens in silence, re-run that one with `-ss <seconds>` before `-i` to start at the first strong phrase.

`public/music/CREDITS.md`:

```markdown
# Bundled music

All tracks are public domain or CC0 and may be used commercially without attribution.
Each was trimmed to 60 seconds, loudness-normalised and faded for use under video ads.

| File | Work | Performer | Licence | Source |
|---|---|---|---|---|
| suspenseful.mp3 | Grieg — In the Hall of the Mountain King | Musopen Symphony Orchestra | Public domain | https://commons.wikimedia.org/wiki/File:Musopen_-_In_the_Hall_Of_The_Mountain_King.ogg |
| epic.mp3 | Wagner — Ride of the Valkyries | Historic recording, U.S. National Park Service (Edison NHP) collection | Public domain | https://commons.wikimedia.org/wiki/File:Richard_Wagner_-_Ride_of_the_Valkyries.ogg |
| ambient.mp3 | Satie — Gymnopédie No. 1 | Teknopazzo | CC0 | https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1..ogg |
| upbeat.mp3 | Joplin — The Entertainer (1902 piano roll) | Scott Joplin | Public domain | https://commons.wikimedia.org/wiki/File:Scott_Joplin_-_04_-_The_Entertainer_1902_piano_roll.mp3 |
| emotional.mp3 | Satie — Gymnopédie No. 2 | Michael Laucke | Public domain | https://commons.wikimedia.org/wiki/File:Satie_Gymnopedie_No_2_performed_by_Michael_Laucke.flac |
```

- [ ] **Step 2: Write the failing spec tests** — append to `lib/services/ads/videoSpec.test.ts` (and add `MUSIC_TRACKS, musicUrl, resolveMusic` to its import):

```ts
describe('music', () => {
  const base = defaultVideoSpec({ title: 'T', mood: 'epic' })

  it('defaults to the library track for the mood, and specs saved before music still validate', () => {
    expect(base.music).toBeUndefined()
    expect(resolveMusic(base)).toEqual({ kind: 'library', track: 'epic' })
    expect(adVideoSpecSchema.safeParse(base).success).toBe(true)
  })

  it('maps each choice to a browser URL', () => {
    expect(musicUrl({ kind: 'library', track: 'ambient' })).toBe('/music/ambient.mp3')
    expect(musicUrl({ kind: 'upload', url: '/api/files/ads/pub_1/music/x-track.mp3', name: 'x.mp3' })).toBe('/api/files/ads/pub_1/music/x-track.mp3')
    expect(musicUrl({ kind: 'none' })).toBeNull()
  })

  it('offers one track per mood and rejects uploads from other sites', () => {
    expect(MUSIC_TRACKS.map((t) => t.key)).toEqual(['suspenseful', 'epic', 'ambient', 'upbeat', 'emotional'])
    const bad = { ...base, music: { kind: 'upload', url: 'http://evil.example/x.mp3', name: 'x' } }
    expect(adVideoSpecSchema.safeParse(bad).success).toBe(false)
  })
})
```

Run: `npx vitest run lib/services/ads/videoSpec.test.ts`
Expected: FAIL — `resolveMusic` is not exported.

- [ ] **Step 3: Implement in `videoSpec.ts`**

Add above `adVideoSpecSchema`:

```ts
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
```

Add to the `adVideoSpecSchema` object, after `mood`:

```ts
  // Optional so specs saved before music existed still validate.
  music: musicSchema.optional(),
```

Add after `readVideoSpec`:

```ts
/** The saved music choice, or the bundled track that matches the mood. */
export function resolveMusic(spec: Pick<AdVideoSpec, 'music' | 'mood'>): NonNullable<AdVideoSpec['music']> {
  return spec.music ?? { kind: 'library', track: spec.mood }
}

export function musicUrl(music: NonNullable<AdVideoSpec['music']>): string | null {
  if (music.kind === 'none') return null
  return music.kind === 'library' ? `/music/${music.track}.mp3` : music.url
}
```

(The mood keys and track keys are the same five words, so `track: spec.mood` type-checks.)

If Blob storage is configured, `storeFile` returns `https://` URLs; in that case relax the upload rule to `z.string().regex(/^(\/api\/files\/|https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\/)/)` — check which one `storeFile` returns in this environment (`isBlobConfigured()`) and keep only what it produces.

In `lib/services/shared/upload.ts` add `'audio/mp4': 'm4a',` to `EXTENSIONS`.

Run: `npx vitest run lib/services/ads/videoSpec.test.ts`
Expected: PASS.

- [ ] **Step 4: Play the music in the composition and the preview**

`BookTrailerComposition.tsx`: add `Audio` to the `remotion` import; add `musicSrc?: string | null` to `BookTrailerCompositionProps`; destructure `musicSrc` in `BookTrailerComposition`; and as the first child of the root `<AbsoluteFill>` add:

```tsx
      {musicSrc && (
        <Audio
          src={musicSrc}
          loop
          volume={(f) =>
            interpolate(f, [0, 15, durationInFrames - 30, durationInFrames], [0, 0.8, 0.8, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
```

`TrailerLivePreviewPlayer.tsx`: import `musicUrl, resolveMusic` and set `const inputProps: BookTrailerCompositionProps = { spec, title, author, coverUrl, interiorImageUrls, musicSrc: musicUrl(resolveMusic(spec)) }`.

- [ ] **Step 5: Write the failing upload-route test**

```ts
// app/api/ads/projects/[id]/music/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/providers/storage', () => ({ storeFile: vi.fn(async (p: string) => ({ url: `/api/files/${p}` })) }))

import { POST } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { storeFile } from '@/lib/providers/storage'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const upload = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return new Request('http://localhost', { method: 'POST', body: form })
}

describe('POST /api/ads/projects/:id/music', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue({ id: 'book_1' } as any)
  })

  it('stores an MP3 under the publisher and returns its URL and name', async () => {
    const res = await POST(upload(new File([Buffer.from('ID3')], 'Theme Song.mp3', { type: 'audio/mpeg' })), ctx)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Theme Song.mp3')
    expect(body.url).toMatch(/^\/api\/files\/ads\/pub_1\/music\/.+-track\.mp3$/)
    expect(storeFile).toHaveBeenCalledWith(expect.stringMatching(/^ads\/pub_1\/music\//), expect.any(Buffer), 'audio/mpeg')
  })

  it('rejects files that are not audio', async () => {
    const res = await POST(upload(new File(['x'], 'notes.txt', { type: 'text/plain' })), ctx)
    expect(res.status).toBe(400)
    expect(storeFile).not.toHaveBeenCalled()
  })

  it('rejects files over 15 MB', async () => {
    const big = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'long.mp3', { type: 'audio/mpeg' })
    expect((await POST(upload(big), ctx)).status).toBe(400)
  })
})
```

Run: `npx vitest run "app/api/ads/projects/[id]/music"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 6: Implement the upload route**

```ts
// app/api/ads/projects/[id]/music/route.ts
import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { storeFile } from '@/lib/providers/storage'
import { assetPath } from '@/lib/services/shared/upload'

const MAX_BYTES = 15 * 1024 * 1024
// Browsers report the same formats under several names.
const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/mp4': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const file = (await request.formData().catch(() => null))?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choose an audio file to upload.' }, { status: 400 })
  }
  const type = AUDIO_TYPES[file.type]
  if (!type) return NextResponse.json({ error: 'Use an MP3, WAV or M4A file.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Music files can be up to 15 MB.' }, { status: 400 })

  const { url } = await storeFile(assetPath('ads/music', publisherId, 'track', type), Buffer.from(await file.arrayBuffer()), type)
  return NextResponse.json({ url, name: file.name.slice(0, 120) }, { status: 201 })
}
```

Run: `npx vitest run "app/api/ads/projects/[id]/music"`
Expected: PASS (3 tests).

- [ ] **Step 7: Music picker in the Instant Video card**

In `components/ads/InstantVideoCard.tsx`: add `Music, Pause, Play, Upload` to the lucide import; add `MUSIC_TRACKS, musicUrl, resolveMusic` to the videoSpec import; add `useRef` to the React import. Add state and helpers after the existing state:

```tsx
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const music = resolveMusic(spec)
  const musicValue = music.kind === 'library' ? music.track : music.kind
  const setMusic = (next: NonNullable<AdVideoSpec['music']>) => {
    audioRef.current?.pause()
    setPlaying(false)
    setSpec((s) => ({ ...s, music: next }))
  }

  async function uploadMusic(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/ads/projects/${projectId}/music`, { method: 'POST', body: form })
    const body = await res.json().catch(() => ({}))
    setUploading(false)
    if (!res.ok) {
      toast.error(body.error ?? 'We couldn’t upload that file.')
      return
    }
    setMusic({ kind: 'upload', url: body.url, name: body.name })
  }

  function togglePreview() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else void audio.play()
    setPlaying(!playing)
  }
```

Add this fieldset after the Length/Format grid:

```tsx
          <fieldset>
            <legend className={labelClass}>
              <span className="inline-flex items-center gap-1.5"><Music className="size-3.5" aria-hidden /> Music</span>
            </legend>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <select
                aria-label="Music track"
                className={cn(inputClass, 'flex-1')}
                value={musicValue}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'none') setMusic({ kind: 'none' })
                  else if (value !== 'upload') setMusic({ kind: 'library', track: value as (typeof MUSIC_TRACKS)[number]['key'] })
                }}
              >
                <option value="none">No music</option>
                {MUSIC_TRACKS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} — {t.composer} ({t.key})
                  </option>
                ))}
                {music.kind === 'upload' && <option value="upload">Your upload: {music.name}</option>}
              </select>
              {musicUrl(music) && (
                <button type="button" onClick={togglePreview} aria-label={playing ? 'Pause music preview' : 'Play music preview'} className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-ink transition hover:border-instant/50">
                  {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                </button>
              )}
              <label className={cn(buttonClasses({ variant: 'secondary', size: 'sm' }), 'cursor-pointer')}>
                <Upload className="size-3.5" aria-hidden /> {uploading ? 'Uploading…' : 'Upload your own'}
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/mp4,.mp3,.wav,.m4a"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadMusic(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            <audio ref={audioRef} src={musicUrl(music) ?? undefined} onEnded={() => setPlaying(false)} preload="none" />
            <p className="mt-1.5 text-xs text-ink-muted">Bundled tracks are public domain and free to use in ads. Upload only music you have the rights to.</p>
          </fieldset>
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npx vitest run lib/services/ads/videoSpec.test.ts "app/api/ads/projects/[id]/music"`
Expected: tsc prints nothing; PASS.

In the browser: results page → play the preview → music fades in; switch track → the preview plays the new track; "No music" → silent; upload an MP3 → it appears as "Your upload: …" and plays; **Save** → reload → the choice is kept.

- [ ] **Step 9: Commit**

```bash
git add public/music lib/services/ads/videoSpec.ts lib/services/ads/videoSpec.test.ts lib/services/shared/upload.ts components/trailer components/ads/InstantVideoCard.tsx "app/api/ads/projects/[id]/music"
git commit -m "feat(ads): music for video ads — five public-domain tracks, picker and upload

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Export matches the preview

### Task 5: Remotion server bundle

**Files:**
- Create: `remotion/index.ts`, `remotion/Root.tsx`, `scripts/remotion-bundle.mjs`
- Modify: `package.json` (deps + scripts), `.gitignore`, `next.config.ts`

**Interfaces:**
- Consumes: `BookTrailerComposition` (Task 3), `FPS`, `defaultVideoSpec`, `videoDimensions`, `videoDurationInFrames` (Task 1).
- Produces: a static bundle in `.remotion-bundle/` exposing composition `AdVideo` (props `BookTrailerCompositionProps`).

- [ ] **Step 1: Install**

```bash
npm install --save-exact @remotion/renderer@4.0.525 @remotion/bundler@4.0.525
```

- [ ] **Step 2: Create the entry and root**

```ts
// remotion/index.ts
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'

registerRoot(RemotionRoot)
```

```tsx
// remotion/Root.tsx
import { Composition } from 'remotion'
import {
  BookTrailerComposition,
  type BookTrailerCompositionProps,
} from '../components/trailer/remotion/BookTrailerComposition'
import { FPS, defaultVideoSpec, videoDimensions, videoDurationInFrames } from '../lib/services/ads/videoSpec'

const defaults: BookTrailerCompositionProps = {
  spec: defaultVideoSpec({ title: 'Preview' }),
  title: 'Preview',
  author: '',
  coverUrl: null,
  interiorImageUrls: [],
}

export function RemotionRoot() {
  return (
    <Composition
      id="AdVideo"
      component={BookTrailerComposition}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={videoDurationInFrames(defaults.spec)}
      defaultProps={defaults}
      calculateMetadata={({ props }) => ({
        ...videoDimensions(props.spec.format),
        durationInFrames: videoDurationInFrames(props.spec),
      })}
    />
  )
}
```

- [ ] **Step 3: Create the bundle script**

```js
// scripts/remotion-bundle.mjs
// Remotion's bundler cannot run inside Next.js, so the video composition is
// bundled once here and the app renders against the static output.
import path from 'node:path'
import { bundle } from '@remotion/bundler'

const root = process.cwd()
const outDir = path.join(root, '.remotion-bundle')

await bundle({
  entryPoint: path.join(root, 'remotion/index.ts'),
  outDir,
  webpackOverride: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: { ...(config.resolve?.alias ?? {}), '@': root },
    },
  }),
})

console.log(`Remotion bundle written to ${outDir}`)
```

`package.json` scripts — add `"remotion:bundle": "node scripts/remotion-bundle.mjs",` and change build to `"build": "npm run remotion:bundle && next build",`.

`.gitignore` — add a line `.remotion-bundle/`.

`next.config.ts`:

```ts
import type { NextConfig } from 'next'
const config: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', '@remotion/renderer', '@remotion/bundler'],
}
export default config
```

- [ ] **Step 4: Build it**

Run: `npm run remotion:bundle && ls .remotion-bundle/index.html && npx tsc --noEmit`
Expected: "Remotion bundle written to …/.remotion-bundle"; the `ls` prints the path; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add remotion scripts/remotion-bundle.mjs package.json package-lock.json .gitignore next.config.ts
git commit -m "build: prebuild the video composition for server rendering

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Server render service

**Files:**
- Create: `lib/services/ads/videoAssets.ts`, `lib/services/ads/renderVideo.ts`, `lib/services/ads/renderVideo.test.ts`

**Interfaces:**
- Consumes: `readStoredFile`, `toDataUri` (`lib/providers/storage.ts`); the bundle from Task 5.
- Produces:
  - `inlineImage(url: string | null | undefined): Promise<string | null>`
  - `adVideoImages(book: { frontCoverUrl: string | null; interiorImageUrls: string[] }): Promise<{ coverUrl: string | null; interiorImageUrls: string[] }>`
  - `inlineMusic(music): Promise<string | null>` (data URI) and `musicFile(music, dir): Promise<string | null>` (path for ffmpeg) — music types from Task 4b
  - `class AdVideoRenderError extends Error`
  - `bundleDir(): string`
  - `renderAdVideo(inputProps: Record<string, unknown>, compositionId?: string): Promise<RenderedAdVideo>` where `RenderedAdVideo = { videoBuffer: Buffer; posterBuffer: Buffer; durationSec: number; width: number; height: number }`
  - `renderStillPng(inputProps: Record<string, unknown>, compositionId: string): Promise<Buffer>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/services/ads/renderVideo.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { AdVideoRenderError, renderAdVideo } from './renderVideo'
import { defaultVideoSpec } from './videoSpec'

const realBundle = path.join(process.cwd(), '.remotion-bundle', 'index.html')

afterEach(() => {
  delete process.env.REMOTION_BUNDLE_DIR
})

describe('renderAdVideo', () => {
  it('explains how to fix a missing bundle', async () => {
    process.env.REMOTION_BUNDLE_DIR = '/nonexistent/remotion-bundle'
    const attempt = renderAdVideo({})
    await expect(attempt).rejects.toBeInstanceOf(AdVideoRenderError)
    await expect(renderAdVideo({})).rejects.toThrow(/remotion:bundle/)
  })

  it.skipIf(!existsSync(realBundle))(
    'renders an MP4 and a poster from the prebuilt bundle',
    async () => {
      const spec = { ...defaultVideoSpec({ title: 'Smoke Test', blurb: 'A short line.' }), length: '6s' as const, format: '1:1' as const }
      const out = await renderAdVideo({ spec, title: 'Smoke Test', author: 'Tester', coverUrl: null, interiorImageUrls: [] })
      expect(out.videoBuffer.subarray(4, 8).toString()).toBe('ftyp')
      expect(out.posterBuffer.subarray(1, 4).toString()).toBe('PNG')
      expect(out.durationSec).toBe(6)
      expect(out.width).toBe(1080)
      expect(out.height).toBe(1080)
    },
    240_000
  )
})
```

Run: `npx vitest run lib/services/ads/renderVideo.test.ts`
Expected: FAIL — cannot resolve `./renderVideo`.

- [ ] **Step 2: Implement**

```ts
// lib/services/ads/videoAssets.ts
import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { readStoredFile, toDataUri } from '@/lib/providers/storage'
import type { AdVideoSpec } from './videoSpec'

/** Headless Chrome and OpenRouter have no session cookie, so stored images travel inline. */
export async function inlineImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    return toDataUri(await readStoredFile(url))
  } catch {
    return null
  }
}

/** The chosen music as a data URI for the server render; bundled tracks are read from public/. */
export async function inlineMusic(music: NonNullable<AdVideoSpec['music']>): Promise<string | null> {
  if (music.kind === 'none') return null
  if (music.kind === 'library') {
    const data = await readFile(path.join(process.cwd(), 'public', 'music', `${music.track}.mp3`))
    return `data:audio/mpeg;base64,${data.toString('base64')}`
  }
  return inlineImage(music.url)
}

/** Path of a bundled track on disk, or the upload copied to `dir`; for ffmpeg. */
export async function musicFile(music: NonNullable<AdVideoSpec['music']>, dir: string): Promise<string | null> {
  if (music.kind === 'none') return null
  if (music.kind === 'library') return path.join(process.cwd(), 'public', 'music', `${music.track}.mp3`)
  try {
    const target = path.join(dir, 'music-upload')
    await writeFile(target, (await readStoredFile(music.url)).data)
    return target
  } catch {
    return null
  }
}

export async function adVideoImages(book: { frontCoverUrl: string | null; interiorImageUrls: string[] }) {
  const [coverUrl, ...interiors] = await Promise.all([
    inlineImage(book.frontCoverUrl),
    ...book.interiorImageUrls.slice(0, 2).map(inlineImage),
  ])
  return { coverUrl, interiorImageUrls: interiors.filter((u): u is string => Boolean(u)) }
}
```

```ts
// lib/services/ads/renderVideo.ts
import path from 'node:path'
import os from 'node:os'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'

export class AdVideoRenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdVideoRenderError'
  }
}

export function bundleDir(): string {
  return process.env.REMOTION_BUNDLE_DIR ?? path.join(process.cwd(), '.remotion-bundle')
}

export interface RenderedAdVideo {
  videoBuffer: Buffer
  posterBuffer: Buffer
  durationSec: number
  width: number
  height: number
}

async function prepare(inputProps: Record<string, unknown>, compositionId: string) {
  const serveUrl = bundleDir()
  if (!existsSync(path.join(serveUrl, 'index.html'))) {
    throw new AdVideoRenderError('The video bundle is missing. Run `npm run remotion:bundle` and try again.')
  }
  const renderer = await import('@remotion/renderer')
  await renderer.ensureBrowser()
  const composition = await renderer.selectComposition({ serveUrl, id: compositionId, inputProps })
  return { renderer, serveUrl, composition }
}

function asRenderError(err: unknown): AdVideoRenderError {
  if (err instanceof AdVideoRenderError) return err
  return new AdVideoRenderError(err instanceof Error ? err.message : 'Video rendering failed')
}

/** Renders a composition from the prebuilt bundle — the same component the browser preview plays. */
export async function renderAdVideo(inputProps: Record<string, unknown>, compositionId = 'AdVideo'): Promise<RenderedAdVideo> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ad-video-'))
  try {
    const { renderer, serveUrl, composition } = await prepare(inputProps, compositionId)
    const videoPath = path.join(dir, 'video.mp4')
    const posterPath = path.join(dir, 'poster.png')
    // Several ad placements reject a file with no audio stream at all.
    await renderer.renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: videoPath, inputProps, enforceAudioTrack: true })
    await renderer.renderStill({ composition, serveUrl, output: posterPath, inputProps, frame: Math.floor(composition.durationInFrames * 0.6) })
    const [videoBuffer, posterBuffer] = await Promise.all([readFile(videoPath), readFile(posterPath)])
    return {
      videoBuffer,
      posterBuffer,
      durationSec: composition.durationInFrames / composition.fps,
      width: composition.width,
      height: composition.height,
    }
  } catch (err) {
    throw asRenderError(err)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** A single PNG frame; transparent where the composition draws nothing. */
export async function renderStillPng(inputProps: Record<string, unknown>, compositionId: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ad-still-'))
  try {
    const { renderer, serveUrl, composition } = await prepare(inputProps, compositionId)
    const output = path.join(dir, 'still.png')
    await renderer.renderStill({ composition, serveUrl, output, inputProps, imageFormat: 'png' })
    return await readFile(output)
  } catch (err) {
    throw asRenderError(err)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run lib/services/ads/renderVideo.test.ts`
Expected: PASS (2 tests). The first run downloads Chrome Headless Shell (~100 MB). If it fails with missing shared libraries, install them (`sudo apt-get install -y libnss3 libatk-bridge2.0-0 libgbm1 libxkbcommon0 libasound2t64`) and rerun.

- [ ] **Step 4: Commit**

```bash
git add lib/services/ads/videoAssets.ts lib/services/ads/renderVideo.ts lib/services/ads/renderVideo.test.ts
git commit -m "feat(ads): server-render ad videos from the preview composition

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Export route, generate route, "Save & export MP4"

**Files:**
- Create: `app/api/ads/projects/[id]/video/instant/route.ts`, `app/api/ads/projects/[id]/video/instant/route.test.ts`
- Modify: `app/api/ads/projects/[id]/generate/route.ts`, `app/api/ads/projects/[id]/generate/route.test.ts`, `components/ads/InstantVideoCard.tsx`
- Delete: `lib/services/trailer/video.ts`, `lib/services/trailer/video.test.ts`

**Interfaces:**
- Consumes: `renderAdVideo`, `AdVideoRenderError`, `adVideoImages`, `readVideoSpec`, `bookVideoSource`, `getLatestCreativeSetForBook(bookId, publisherId)`.
- Produces: `POST /api/ads/projects/:id/video/instant` → `200 { videoUrl, videoPosterUrl, videoDuration }` | `400 { error }` | `404` | `500 { error }`.

- [ ] **Step 1: Write the failing route test**

```ts
// app/api/ads/projects/[id]/video/instant/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultVideoSpec } from '@/lib/services/ads/videoSpec'

const savedSpec = defaultVideoSpec({ title: 'Saved hook' })
const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: '/api/files/ads/pub_1/cover.png', interiorImageUrls: [],
  customHook: null, ctaText: null, videoStyle: null, videoFormat: null, videoLength: null, videoMood: null, videoSpec: savedSpec,
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({
  getBookForPublisher: vi.fn(),
  getLatestCreativeSetForBook: vi.fn(),
}))
vi.mock('@/lib/services/ads/videoAssets', () => ({
  adVideoImages: vi.fn().mockResolvedValue({ coverUrl: 'data:cover', interiorImageUrls: [] }),
  inlineMusic: vi.fn().mockResolvedValue('data:audio/mpeg;base64,AA'),
}))
vi.mock('@/lib/services/ads/renderVideo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/ads/renderVideo')>()),
  renderAdVideo: vi.fn(),
}))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn(async (p: string) => ({ url: `/api/files/${p}` })),
}))
vi.mock('@/lib/db', () => ({ prisma: { creativeSet: { update: vi.fn().mockResolvedValue({}) } } }))

import { POST } from './route'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { AdVideoRenderError, renderAdVideo } from '@/lib/services/ads/renderVideo'
import { prisma } from '@/lib/db'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const req = () => new Request('http://localhost', { method: 'POST' })

describe('POST /api/ads/projects/:id/video/instant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValue({ id: 'set_1' } as any)
    vi.mocked(renderAdVideo).mockResolvedValue({
      videoBuffer: Buffer.from('mp4'), posterBuffer: Buffer.from('png'), durationSec: 15, width: 1920, height: 1080,
    })
  })

  it('renders the saved spec and replaces the set video', async () => {
    const res = await POST(req(), ctx)
    expect(res.status).toBe(200)
    expect(renderAdVideo).toHaveBeenCalledWith(
      expect.objectContaining({ spec: savedSpec, coverUrl: 'data:cover', title: 'T', musicSrc: 'data:audio/mpeg;base64,AA' })
    )
    const json = await res.json()
    expect(json.videoUrl).toMatch(/creatives\/set_1\/video-.+\.mp4$/)
    expect(prisma.creativeSet.update).toHaveBeenCalledWith({
      where: { id: 'set_1' },
      data: { videoUrl: json.videoUrl, videoPosterUrl: json.videoPosterUrl, videoDuration: 15 },
    })
  })

  it('asks for a generated campaign first', async () => {
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValue(null as any)
    expect((await POST(req(), ctx)).status).toBe(400)
  })

  it('passes a render problem through as a readable 500', async () => {
    vi.mocked(renderAdVideo).mockRejectedValue(new AdVideoRenderError('The video bundle is missing. Run `npm run remotion:bundle` and try again.'))
    const res = await POST(req(), ctx)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/remotion:bundle/)
  })

  it('returns 404 for another publisher’s project', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValue(null)
    expect((await POST(req(), ctx)).status).toBe(404)
  })
})
```

Run: `npx vitest run "app/api/ads/projects/[id]/video/instant"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 2: Implement the route**

```ts
// app/api/ads/projects/[id]/video/instant/route.ts
import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { bookVideoSource, readVideoSpec, resolveMusic } from '@/lib/services/ads/videoSpec'
import { adVideoImages, inlineMusic } from '@/lib/services/ads/videoAssets'
import { AdVideoRenderError, renderAdVideo } from '@/lib/services/ads/renderVideo'
import { storeFile } from '@/lib/providers/storage'
import { prisma } from '@/lib/db'

export const maxDuration = 300

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (!set) return NextResponse.json({ error: 'Generate the campaign before exporting a video.' }, { status: 400 })

  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  try {
    const video = await renderAdVideo({
      spec,
      title: book.title ?? 'Untitled book',
      author: book.author ?? '',
      musicSrc: await inlineMusic(resolveMusic(spec)),
      ...(await adVideoImages(book)),
    })

    // A new name per export, so the browser never plays a cached older cut.
    const stamp = Date.now().toString(36)
    const dir = `ads/${publisherId}/creatives/${set.id}`
    const [mp4, poster] = await Promise.all([
      storeFile(`${dir}/video-${stamp}.mp4`, video.videoBuffer, 'video/mp4'),
      storeFile(`${dir}/poster-${stamp}.png`, video.posterBuffer, 'image/png'),
    ])
    const videoDuration = Math.round(video.durationSec)
    await prisma.creativeSet.update({
      where: { id: set.id },
      data: { videoUrl: mp4.url, videoPosterUrl: poster.url, videoDuration },
    })
    return NextResponse.json({ videoUrl: mp4.url, videoPosterUrl: poster.url, videoDuration })
  } catch (err) {
    console.error('instant video export failed', err)
    const message = err instanceof AdVideoRenderError ? err.message : 'We couldn’t export the video. Please try again.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

Run: `npx vitest run "app/api/ads/projects/[id]/video/instant"`
Expected: PASS (4 tests).

- [ ] **Step 3: Switch the generate route to the same renderer**

In `app/api/ads/projects/[id]/generate/route.ts`:
- delete the `import { toTrailerAspectRatio, toTrailerLength, toTrailerMusicMood, toTrailerStyle } from '@/lib/services/trailer/options'` block;
- add imports:

```ts
import { renderAdVideo } from '@/lib/services/ads/renderVideo'
import { adVideoImages, inlineMusic } from '@/lib/services/ads/videoAssets'
import { bookVideoSource, readVideoSpec, resolveMusic } from '@/lib/services/ads/videoSpec'
```

- replace the two statements starting `const { renderTrailerVideoAndPoster } = await import(…)` and `const video = await renderTrailerVideoAndPoster({ … })` with:

```ts
        const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
        const video = await renderAdVideo({
          spec,
          title: details.title,
          author: details.author,
          musicSrc: await inlineMusic(resolveMusic(spec)),
          ...(await adVideoImages(book)),
        })
```

In `app/api/ads/projects/[id]/generate/route.test.ts` replace the `vi.mock('@/lib/services/trailer/video', …)` block with:

```ts
vi.mock('@/lib/services/ads/renderVideo', () => ({
  renderAdVideo: vi.fn().mockResolvedValue({
    videoBuffer: Buffer.from('video'), posterBuffer: Buffer.from('poster'), durationSec: 15, width: 1920, height: 1080,
  }),
}))
vi.mock('@/lib/services/ads/videoAssets', () => ({
  adVideoImages: vi.fn().mockResolvedValue({ coverUrl: 'data:cover', interiorImageUrls: [] }),
  inlineMusic: vi.fn().mockResolvedValue(null),
}))
```

Delete the old renderer:

```bash
git rm lib/services/trailer/video.ts lib/services/trailer/video.test.ts
grep -rn "trailer/video" app lib components
```

Expected: `grep` prints nothing.

- [ ] **Step 4: Add "Save & export MP4" to the card**

In `components/ads/InstantVideoCard.tsx`:
- add `Film` to the lucide import;
- after the `saving` state add:

```tsx
  const [exporting, setExporting] = useState(false)
  const [current, setCurrent] = useState(video)
```

- after `save()` add:

```tsx
  async function exportVideo() {
    if (dirty && !(await save())) return
    setExporting(true)
    const toastId = toast.loading('Rendering your video…', { description: 'This usually takes under a minute.' })
    const res = await fetch(`/api/ads/projects/${projectId}/video/instant`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setExporting(false)
    if (!res.ok) {
      toast.error('Export failed', { id: toastId, description: json.error })
      return
    }
    setCurrent(json)
    toast.success('Your video is ready', { id: toastId, description: 'Download it below the title.' })
  }
```

- in the header, change the download link to use `current.videoUrl` (both the condition and `href`), label it `Download MP4{current.videoDuration ? ` (${current.videoDuration}s)` : ''}`, and after the Save button add:

```tsx
          <Button type="button" size="sm" onClick={exportVideo} loading={exporting} disabled={exporting || Boolean(problem)} className="bg-instant text-canvas hover:bg-instant/90">
            <Film className="size-3.5" aria-hidden /> Save &amp; export MP4
          </Button>
```

  and change the Save button to `variant="secondary"` without the green classes.

- [ ] **Step 5: Verify end to end**

Run: `npx vitest run "app/api/ads" lib/services/ads && npx tsc --noEmit`
Expected: all PASS (apart from DB-backed `queries.test.ts`); tsc prints nothing.

Restart the dev server so it loads the new Prisma client and `serverExternalPackages`:

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill
nohup npx next dev -H 0.0.0.0 -p 3000 > /tmp/claude-1000/devserver.log 2>&1 &
timeout 60 bash -c 'until curl -sf -o /dev/null localhost:3000; do sleep 1; done'
```

In the browser (or Playwright): results page → change the hook → **Save & export MP4** → wait for "Your video is ready" → download. Check the file:

```bash
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of compact <downloaded>.mp4
```

Expected: one video stream at the spec's size, one audio stream (the chosen music — play the file and listen), duration equal to the spec's length. Open a frame (`ffmpeg -ss 1 -i <file> -frames:v 1 frame.png`) and confirm the new hook text is drawn in the chosen font.

- [ ] **Step 6: Commit**

```bash
git add "app/api/ads/projects/[id]/video/instant" "app/api/ads/projects/[id]/generate" components/ads/InstantVideoCard.tsx
git commit -m "feat(ads): export the Instant Video exactly as previewed

The generate route and the new export route both render the preview's
composition; the separate canvas trailer renderer is removed.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — AI Video

### Task 8: Probe OpenRouter image-to-video with a data URI (throwaway)

This decides whether local files can be sent to the video model. It costs about $0.25 (one 3-second Kling clip). Nothing from this task is committed.

- [ ] **Step 1: Run the probe**

```bash
cat > /tmp/claude-1000/-home-pratap-work-Publisher-toolkit/7eb9980e-21bd-4f54-b63a-ec0765db9b7e/scratchpad/probe-video.mjs <<'EOF'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const key = env.OPENROUTER_API_KEY
const png = fs.readdirSync('.local-storage/ads/dev-local-publisher').find((f) => f.endsWith('front.png'))
const dataUri = `data:image/png;base64,${fs.readFileSync(`.local-storage/ads/dev-local-publisher/${png}`).toString('base64')}`
const submit = await fetch('https://openrouter.ai/api/v1/videos', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'kwaivgi/kling-v3.0-std', prompt: 'Slow push-in on the book cover, soft light sweep', duration: 3, aspect_ratio: '16:9', resolution: '720p', generate_audio: false, frame_images: [{ type: 'image_url', image_url: { url: dataUri }, frame_type: 'first_frame' }] }),
})
const job = await submit.json()
console.log('submit', submit.status, JSON.stringify(job).slice(0, 300))
if (!job.id) process.exit(1)
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 10_000))
  const s = await (await fetch(`https://openrouter.ai/api/v1/videos/${job.id}`, { headers: { Authorization: `Bearer ${key}` } })).json()
  console.log(i, s.status, s.error ?? '', s.usage?.cost ?? '')
  if (['completed', 'failed', 'cancelled', 'expired'].includes(s.status)) break
}
EOF
cp /tmp/claude-1000/-home-pratap-work-Publisher-toolkit/7eb9980e-21bd-4f54-b63a-ec0765db9b7e/scratchpad/probe-video.mjs ./.probe-video.tmp.mjs && timeout 700 node ./.probe-video.tmp.mjs; rm -f ./.probe-video.tmp.mjs
```

- [ ] **Step 2: Record the outcome**

- `submit 200/202` and later `completed` → data URIs work; continue with Task 9 as written.
- Submit rejects the data URI (4xx mentioning the image/URL) → **stop and report to the user**: AI video then needs publicly reachable image URLs, which means configuring Vercel Blob (`BLOB_READ_WRITE_TOKEN`) so `storeFile` returns public URLs. Do not work around it.

---

### Task 9: OpenRouter video client

**Files:**
- Create: `lib/providers/aiVideo.ts`, `lib/providers/aiVideo.test.ts`
- Modify: `lib/providers/ai.ts:8,127-129`, `.env.example`

**Interfaces:**
- Produces:
  - `type VideoModelInfo = { id: string; durations: number[]; aspectRatios: string[]; resolutions: string[]; pricePerSecond: number | null }`
  - `pricePerSecond(skus?: Record<string, string>): number | null`
  - `getVideoModelInfo(model: string, apiKey: string): Promise<VideoModelInfo | null>`
  - `pickDuration(wanted: number, supported: number[]): number`
  - `pickResolution(supported: string[]): string | undefined`
  - `submitVideoJob(input: { apiKey: string; model: string; prompt: string; imageUrl: string; durationSec: number; aspectRatio: string; resolution?: string }): Promise<string>` (job id)
  - `type VideoJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired'`
  - `getVideoJob(apiKey: string, id: string): Promise<{ status: VideoJobStatus; error?: string; costUsd?: number }>`
  - `downloadVideoJob(apiKey: string, id: string): Promise<Buffer>`
  - `getVideoModelName(): string` (in `ai.ts`, no arguments)

- [ ] **Step 1: Write the failing tests**

```ts
// lib/providers/aiVideo.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getVideoJob, getVideoModelInfo, pickDuration, pickResolution, pricePerSecond, submitVideoJob } from './aiVideo'

const fetchMock = vi.fn()
beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('pricePerSecond', () => {
  it('prefers the silent image-to-video price', () => {
    expect(pricePerSecond({ duration_seconds: '0.084', duration_seconds_with_audio: '0.126', image_to_video_duration_seconds_720p: '0.084', text_to_video_duration_seconds_480p: '0.05' })).toBe(0.084)
  })
  it('uses the price without audio and ignores 4K', () => {
    expect(pricePerSecond({ duration_seconds_with_audio: '0.40', duration_seconds_without_audio: '0.20', duration_seconds_without_audio_4k: '0.40' })).toBe(0.2)
  })
  it('returns null for token-priced models', () => {
    expect(pricePerSecond({ video_tokens: '0.000007' })).toBeNull()
  })
})

describe('pickDuration / pickResolution', () => {
  it('chooses the closest supported duration', () => {
    expect(pickDuration(5, [4, 6, 8])).toBe(4)
    expect(pickDuration(7, [3, 5, 7, 10])).toBe(7)
    expect(pickDuration(5, [])).toBe(5)
  })
  it('prefers 720p', () => {
    expect(pickResolution(['1080p', '720p'])).toBe('720p')
    expect(pickResolution(['1080p'])).toBe('1080p')
  })
})

describe('getVideoModelInfo', () => {
  it('finds the model and normalises its capabilities', async () => {
    fetchMock.mockResolvedValue(json({ data: [{ id: 'kwaivgi/kling-v3.0-std', supported_durations: [3, 5], supported_aspect_ratios: ['16:9', '1:1'], supported_resolutions: ['720p'], pricing_skus: { duration_seconds: '0.084' } }] }))
    expect(await getVideoModelInfo('kwaivgi/kling-v3.0-std', 'k')).toEqual({
      id: 'kwaivgi/kling-v3.0-std', durations: [3, 5], aspectRatios: ['16:9', '1:1'], resolutions: ['720p'], pricePerSecond: 0.084,
    })
    expect(await getVideoModelInfo('missing/model', 'k')).toBeNull()
  })
})

describe('submitVideoJob', () => {
  it('sends the documented image-to-video request', async () => {
    fetchMock.mockResolvedValue(json({ id: 'job_1', status: 'pending' }, 202))
    const id = await submitVideoJob({ apiKey: 'k', model: 'm', prompt: 'p', imageUrl: 'data:image/png;base64,AA', durationSec: 5, aspectRatio: '16:9', resolution: '720p' })
    expect(id).toBe('job_1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/videos')
    expect(JSON.parse(init.body)).toEqual({
      model: 'm', prompt: 'p', duration: 5, aspect_ratio: '16:9', resolution: '720p', generate_audio: false,
      frame_images: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA' }, frame_type: 'first_frame' }],
    })
    expect(init.headers.Authorization).toBe('Bearer k')
  })
  it('surfaces the provider’s error message', async () => {
    fetchMock.mockResolvedValue(json({ error: { message: 'aspect_ratio 1:1 is not supported' } }, 400))
    await expect(submitVideoJob({ apiKey: 'k', model: 'm', prompt: 'p', imageUrl: 'x', durationSec: 5, aspectRatio: '1:1' })).rejects.toThrow('aspect_ratio 1:1 is not supported')
  })
})

describe('getVideoJob', () => {
  it('maps status, error and cost', async () => {
    fetchMock.mockResolvedValue(json({ id: 'job_1', status: 'completed', usage: { cost: 0.42 } }))
    expect(await getVideoJob('k', 'job_1')).toEqual({ status: 'completed', error: undefined, costUsd: 0.42 })
  })
})
```

Run: `npx vitest run lib/providers/aiVideo.test.ts`
Expected: FAIL — cannot resolve `./aiVideo`.

- [ ] **Step 2: Implement**

```ts
// lib/providers/aiVideo.ts
/**
 * OpenRouter's asynchronous video API: submit a job, poll it, download the clip.
 * The pure helpers here are also used by the browser to estimate cost.
 */
const BASE = 'https://openrouter.ai/api/v1'

export interface VideoModelInfo {
  id: string
  durations: number[]
  aspectRatios: string[]
  resolutions: string[]
  pricePerSecond: number | null
}

interface RawVideoModel {
  id?: string
  slug?: string
  supported_durations?: number[]
  supported_aspect_ratios?: string[]
  supported_resolutions?: string[]
  pricing_skus?: Record<string, string>
}

/** We buy silent image-to-video at the base resolution; pick that price. Token-priced models return null. */
export function pricePerSecond(skus?: Record<string, string>): number | null {
  if (!skus) return null
  const perSecond = Object.entries(skus).filter(
    ([key]) => key.includes('duration_seconds') && !key.includes('with_audio') && !/4k/i.test(key)
  )
  const chosen =
    perSecond.find(([key]) => key.startsWith('image_to_video')) ??
    perSecond.find(([key]) => key.includes('without_audio')) ??
    perSecond[0]
  const value = chosen ? Number(chosen[1]) : NaN
  return Number.isFinite(value) ? value : null
}

export async function getVideoModelInfo(model: string, apiKey: string): Promise<VideoModelInfo | null> {
  const res = await fetch(`${BASE}/videos/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const body = (await res.json()) as { data?: RawVideoModel[] } | RawVideoModel[]
  const list = Array.isArray(body) ? body : body.data ?? []
  const raw = list.find((m) => (m.id ?? m.slug) === model)
  if (!raw) return null
  return {
    id: raw.id ?? raw.slug ?? model,
    durations: raw.supported_durations ?? [],
    aspectRatios: raw.supported_aspect_ratios ?? [],
    resolutions: raw.supported_resolutions ?? [],
    pricePerSecond: pricePerSecond(raw.pricing_skus),
  }
}

/** The supported duration closest to what the brief asked for. */
export function pickDuration(wanted: number, supported: number[]): number {
  if (supported.length === 0) return wanted
  return supported.reduce((best, d) => (Math.abs(d - wanted) < Math.abs(best - wanted) ? d : best))
}

/** 720p when offered: every current model supports it and it keeps a 3-shot ad affordable. */
export function pickResolution(supported: string[]): string | undefined {
  return supported.includes('720p') ? '720p' : supported[0]
}

function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined
  if (typeof error === 'string') return error
  if (typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return undefined
}

export async function submitVideoJob(input: {
  apiKey: string
  model: string
  prompt: string
  imageUrl: string
  durationSec: number
  aspectRatio: string
  resolution?: string
}): Promise<string> {
  const res = await fetch(`${BASE}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      duration: input.durationSec,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      generate_audio: false,
      frame_images: [{ type: 'image_url', image_url: { url: input.imageUrl }, frame_type: 'first_frame' }],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: unknown }
  if (!res.ok || !body.id) {
    throw new Error(errorMessage(body.error) ?? `The video model rejected the request (HTTP ${res.status}).`)
  }
  return body.id
}

export type VideoJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired'

export async function getVideoJob(apiKey: string, id: string): Promise<{ status: VideoJobStatus; error?: string; costUsd?: number }> {
  const res = await fetch(`${BASE}/videos/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await res.json().catch(() => ({}))) as { status?: VideoJobStatus; error?: unknown; usage?: { cost?: number } }
  if (!res.ok) throw new Error(errorMessage(body.error) ?? `Could not check the video job (HTTP ${res.status}).`)
  return { status: body.status ?? 'pending', error: errorMessage(body.error), costUsd: body.usage?.cost }
}

export async function downloadVideoJob(apiKey: string, id: string): Promise<Buffer> {
  const res = await fetch(`${BASE}/videos/${id}/content?index=0`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`Could not download the generated clip (HTTP ${res.status}).`)
  return Buffer.from(await res.arrayBuffer())
}
```

`lib/providers/ai.ts` — change the default and stop reading the publisher's text-model setting:

```ts
export const DEFAULT_VIDEO_MODEL = 'kwaivgi/kling-v3.0-std'
```

```ts
/** Never the publisher's text-model setting: a chat model cannot make video. */
export function getVideoModelName(): string {
  return process.env.OPENROUTER_VIDEO_MODEL || DEFAULT_VIDEO_MODEL
}
```

`.env.example` — set `OPENROUTER_VIDEO_MODEL=kwaivgi/kling-v3.0-std`. In `.env.local`, change the `OPENROUTER_VIDEO_MODEL="google/veo-2"` line (that model no longer exists on OpenRouter) to `OPENROUTER_VIDEO_MODEL="kwaivgi/kling-v3.0-std"` and tell the user you did.

- [ ] **Step 3: Verify**

Run: `npx vitest run lib/providers && npx tsc --noEmit`
Expected: PASS; tsc prints nothing.

- [ ] **Step 4: Commit**

```bash
git add lib/providers/aiVideo.ts lib/providers/aiVideo.test.ts lib/providers/ai.ts .env.example
git commit -m "feat(ai): OpenRouter image-to-video client; default to Kling 3.0 Std

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: AI video brief (write / revise)

**Files:**
- Create: `lib/services/ads/aiVideoBriefSchema.ts`, `lib/services/ads/aiVideoBrief.ts`, `lib/services/ads/aiVideoBrief.test.ts`
- Create: `app/api/ads/projects/[id]/video/ai/brief/route.ts`, `app/api/ads/projects/[id]/video/ai/brief/route.test.ts`

**Interfaces:**
- Consumes: `generateStructured`, `isAiConfigured`, `type AiCredentials`, `type AiResult` (`lib/providers/ai.ts`); `clip`, `readVideoSpec`, `bookVideoSource` (Task 1).
- Produces:
  - `aiVideoShotSchema`, `aiVideoBriefSchema`, `type AiVideoBrief`, `type AiVideoShot`, `BRIEF_LIMITS`
  - `imageKeys(pageCount: number): string[]`
  - `type BriefFacts = { title: string; author?: string | null; blurb?: string | null; bullets?: string[]; categories?: string[]; cta?: string | null; pageCount: number }`
  - `buildBriefPrompt(facts, options: { current?: AiVideoBrief; instruction?: string; format: string }): string`
  - `sanitizeBrief(brief, keys): AiVideoBrief`, `fallbackBrief(facts): AiVideoBrief`, `BRIEF_SYSTEM`
  - `generateAiVideoBrief(facts, options, credentials?): Promise<AiResult<AiVideoBrief>>`
  - `POST /api/ads/projects/:id/video/ai/brief` body `{ current?: AiVideoBrief; instruction?: string }` → `200 { brief, source }` | `400 { error }` | `404`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/services/ads/aiVideoBrief.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/ai', () => ({ generateStructured: vi.fn() }))

import { generateStructured } from '@/lib/providers/ai'
import { generateAiVideoBrief } from './aiVideoBrief'
import { aiVideoBriefSchema, buildBriefPrompt, fallbackBrief, imageKeys, type AiVideoBrief } from './aiVideoBriefSchema'

const facts = { title: 'Learning RAG', author: 'Pratap', blurb: 'Build retrieval systems.', cta: 'Pre-order now', pageCount: 1 }
const brief: AiVideoBrief = {
  shots: [{ prompt: 'Slow push-in on the cover with a light sweep', sourceImage: 'page-9', durationSec: 5, caption: '' }],
  endCard: { headline: 'Build RAG that works', cta: 'Pre-order now' },
}

beforeEach(() => vi.mocked(generateStructured).mockReset())

describe('imageKeys', () => {
  it('lists the cover and each page', () => {
    expect(imageKeys(2)).toEqual(['cover', 'page-1', 'page-2'])
  })
})

describe('buildBriefPrompt', () => {
  it('names the usable images and the format for a first draft', () => {
    const prompt = buildBriefPrompt(facts, { format: '16:9', instruction: 'moody' })
    expect(prompt).toContain('cover, page-1')
    expect(prompt).toContain('Video format: 16:9')
    expect(prompt).toContain("Publisher's direction: moody")
  })
  it('includes the current shot list and instruction when revising', () => {
    const prompt = buildBriefPrompt(facts, { format: '1:1', current: brief, instruction: 'start with page 1' })
    expect(prompt).toContain(JSON.stringify(brief))
    expect(prompt).toContain("Publisher's instruction: start with page 1")
  })
})

describe('fallbackBrief', () => {
  it('is valid and uses the first page when there is one', () => {
    const b = fallbackBrief(facts)
    expect(aiVideoBriefSchema.safeParse(b).success).toBe(true)
    expect(b.shots.map((s) => s.sourceImage)).toEqual(['cover', 'page-1'])
  })
})

describe('generateAiVideoBrief', () => {
  it('replaces images the book does not have with the cover', async () => {
    vi.mocked(generateStructured).mockResolvedValue({ data: brief, source: 'ai' })
    const result = await generateAiVideoBrief(facts, { format: '16:9' })
    expect(result.data.shots[0].sourceImage).toBe('cover')
  })
  it('keeps the current brief when the AI call fails during a revision', async () => {
    vi.mocked(generateStructured).mockImplementation(async (o: any) => ({ data: o.fallback(), source: 'fallback' }))
    const current = { ...brief, shots: [{ ...brief.shots[0], sourceImage: 'cover' }] }
    const result = await generateAiVideoBrief(facts, { format: '16:9', current, instruction: 'x' })
    expect(result.source).toBe('fallback')
    expect(result.data).toEqual(current)
  })
})
```

```ts
// app/api/ads/projects/[id]/video/ai/brief/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', bullets: [], categories: [], interiorImageUrls: ['/p1.png'],
  customHook: null, ctaText: 'Buy now', videoStyle: null, videoFormat: '1:1', videoLength: null, videoMood: null, videoSpec: null,
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/publisher/settings', () => ({ getPublisherAiCredentials: vi.fn() }))
vi.mock('@/lib/services/ads/aiVideoBrief', () => ({ generateAiVideoBrief: vi.fn() }))

import { POST } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { generateAiVideoBrief } from '@/lib/services/ads/aiVideoBrief'
import { fallbackBrief } from '@/lib/services/ads/aiVideoBriefSchema'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const req = (body: unknown) => new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('POST /api/ads/projects/:id/video/ai/brief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
    vi.mocked(getPublisherAiCredentials).mockResolvedValue({ apiKey: 'sk', model: null })
  })

  it('writes a brief from the book facts in the video format', async () => {
    const brief = fallbackBrief({ title: 'T', pageCount: 1 })
    vi.mocked(generateAiVideoBrief).mockResolvedValue({ data: brief, source: 'ai' })
    const res = await POST(req({ instruction: 'warm' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ brief, source: 'ai' })
    expect(generateAiVideoBrief).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'T', cta: 'Buy now', pageCount: 1 }),
      { current: undefined, instruction: 'warm', format: '1:1' },
      { apiKey: 'sk', model: null }
    )
  })

  it('needs an OpenRouter key', async () => {
    vi.mocked(getPublisherAiCredentials).mockResolvedValue({ apiKey: null, model: null })
    const prev = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
    const res = await POST(req({}), ctx)
    process.env.OPENROUTER_API_KEY = prev
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/OpenRouter/)
  })

  it('rejects an invalid current brief', async () => {
    const res = await POST(req({ current: { shots: [] } }), ctx)
    expect(res.status).toBe(400)
  })
})
```

Run: `npx vitest run lib/services/ads/aiVideoBrief.test.ts "app/api/ads/projects/[id]/video/ai/brief"`
Expected: FAIL — modules not found.

- [ ] **Step 2: Implement the schema module**

```ts
// lib/services/ads/aiVideoBriefSchema.ts
import { z } from 'zod'
import { clip } from './videoSpec'

export const BRIEF_LIMITS = { shots: 3, prompt: 600, caption: 40, headline: 48, cta: 28 } as const

export const aiVideoShotSchema = z.object({
  prompt: z.string().trim().min(10, 'Describe each shot in a sentence or two').max(BRIEF_LIMITS.prompt),
  sourceImage: z.string().regex(/^(cover|page-\d+)$/),
  durationSec: z.number().int().min(3).max(10),
  caption: z.string().trim().max(BRIEF_LIMITS.caption),
})

export const aiVideoBriefSchema = z.object({
  shots: z.array(aiVideoShotSchema).min(1, 'Keep at least one shot').max(BRIEF_LIMITS.shots),
  endCard: z.object({
    headline: z.string().trim().min(1, 'Add an end-card headline').max(BRIEF_LIMITS.headline),
    cta: z.string().trim().min(1, 'Add a call to action').max(BRIEF_LIMITS.cta),
  }),
})
export type AiVideoBrief = z.infer<typeof aiVideoBriefSchema>
export type AiVideoShot = AiVideoBrief['shots'][number]

export interface BriefFacts {
  title: string
  author?: string | null
  blurb?: string | null
  bullets?: string[]
  categories?: string[]
  cta?: string | null
  pageCount: number
}

/** The images a shot may start from: the cover and each uploaded page. */
export function imageKeys(pageCount: number): string[] {
  return ['cover', ...Array.from({ length: pageCount }, (_, i) => `page-${i + 1}`)]
}

export const BRIEF_SYSTEM = `You are the creative director of short video ads that sell books. You write the shot list that an image-to-video model will animate.

How the video is made:
- Each shot starts from ONE real image — the book's cover or one of its interior pages — and the model animates it. It does not invent a new scene; it moves the camera, the light and the atmosphere of that image.
- After the shots, we add an end card ourselves with the real cover, a headline and a call to action.
- Captions are added by us on top of shots, in the ad's own font.

Rules for every shot prompt:
- Describe motion, not a new picture: the camera move (slow push-in, parallax drift, gentle orbit, tilt), the light (sweep, glow, flicker, dawn) and the atmosphere (dust, embers, rain, drifting paper).
- Never ask for text, titles, letters or changes to the cover design. Video models misspell text.
- Match the book's genre and emotional tone: a children's book feels warm and playful, a thriller tense, a technical book confident and clear.
- One or two concrete, visual sentences. No brand names, no real people, no claims.

Together the shots must feel like one experience: open with intrigue, build towards the book's promise, and hand off to the end card.

Captions: at most 40 characters, readable in one second; use them on at most two shots and leave the others empty. End-card headline: the single strongest reason to read this book, at most 48 characters. Call to action: at most 28 characters.
Never invent awards, rankings, review quotes or numbers. Write in the language of the book's details.`

export function buildBriefPrompt(
  facts: BriefFacts,
  options: { current?: AiVideoBrief; instruction?: string; format: string }
): string {
  const lines: (string | null)[] = [
    `Book: ${facts.title}`,
    facts.author ? `Author: ${facts.author}` : null,
    facts.categories?.length ? `Categories: ${facts.categories.join(', ')}` : null,
    facts.bullets?.length ? `Publisher's bullets:\n- ${facts.bullets.join('\n- ')}` : null,
    facts.blurb ? `Description: ${facts.blurb.slice(0, 1500)}` : null,
    `Video format: ${options.format}`,
    `Images shots can start from: ${imageKeys(facts.pageCount).join(', ')} ("cover" is the front cover; "page-N" is interior page N).`,
    facts.cta ? `Preferred call to action: ${facts.cta}` : null,
    '',
  ]
  const instruction = options.instruction?.trim()
  if (options.current) {
    lines.push(
      "Here is the current shot list as JSON. Revise it following the publisher's instruction and keep everything the instruction does not ask to change.",
      JSON.stringify(options.current),
      '',
      `Publisher's instruction: ${instruction || 'Make it more compelling.'}`
    )
  } else {
    lines.push('Write 2 or 3 shots of 4 to 6 seconds each, then the end card.')
    if (instruction) lines.push(`Publisher's direction: ${instruction}`)
  }
  return lines.filter((l): l is string => l !== null).join('\n')
}

/** Keeps a model's answer inside what can actually be rendered. */
export function sanitizeBrief(brief: AiVideoBrief, keys: string[]): AiVideoBrief {
  return {
    ...brief,
    shots: brief.shots.map((shot) => ({ ...shot, sourceImage: keys.includes(shot.sourceImage) ? shot.sourceImage : 'cover' })),
  }
}

/** Used when the text model is unavailable, so the publisher still has something to edit. */
export function fallbackBrief(facts: Pick<BriefFacts, 'title' | 'cta' | 'pageCount'>): AiVideoBrief {
  const shots: AiVideoShot[] = [
    {
      prompt: 'Slow cinematic push-in on the book cover, a soft band of light sweeping across it, fine dust drifting in the air, shallow depth of field.',
      sourceImage: 'cover',
      durationSec: 5,
      caption: clip(facts.title, BRIEF_LIMITS.caption),
    },
  ]
  if (facts.pageCount > 0) {
    shots.push({
      prompt: 'Gentle parallax drift across the page, warm light slowly brightening, subtle paper texture, calm and inviting.',
      sourceImage: 'page-1',
      durationSec: 5,
      caption: '',
    })
  }
  return {
    shots,
    endCard: { headline: clip(facts.title, BRIEF_LIMITS.headline), cta: clip(facts.cta || 'Get your copy today', BRIEF_LIMITS.cta) },
  }
}
```

```ts
// lib/services/ads/aiVideoBrief.ts
import { generateStructured, type AiCredentials, type AiResult } from '@/lib/providers/ai'
import {
  BRIEF_SYSTEM,
  aiVideoBriefSchema,
  buildBriefPrompt,
  fallbackBrief,
  imageKeys,
  sanitizeBrief,
  type AiVideoBrief,
  type BriefFacts,
} from './aiVideoBriefSchema'

export async function generateAiVideoBrief(
  facts: BriefFacts,
  options: { current?: AiVideoBrief; instruction?: string; format: string },
  credentials?: AiCredentials
): Promise<AiResult<AiVideoBrief>> {
  const result = await generateStructured({
    label: options.current ? 'ai-video-brief-revise' : 'ai-video-brief',
    schema: aiVideoBriefSchema,
    system: BRIEF_SYSTEM,
    prompt: buildBriefPrompt(facts, options),
    credentials,
    temperature: 0.8,
    timeoutMs: 45_000,
    // A failed revision must not throw away what the publisher already has.
    fallback: () => options.current ?? fallbackBrief(facts),
  })
  return { ...result, data: sanitizeBrief(result.data, imageKeys(facts.pageCount)) }
}
```

- [ ] **Step 3: Implement the route**

```ts
// app/api/ads/projects/[id]/video/ai/brief/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { isAiConfigured } from '@/lib/providers/ai'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { generateAiVideoBrief } from '@/lib/services/ads/aiVideoBrief'
import { aiVideoBriefSchema } from '@/lib/services/ads/aiVideoBriefSchema'
import { bookVideoSource, readVideoSpec } from '@/lib/services/ads/videoSpec'

export const maxDuration = 60

const bodySchema = z.object({
  current: aiVideoBriefSchema.optional(),
  instruction: z.string().trim().max(400).optional(),
})

/** Pages beyond five are not offered as shot sources; the brief stays readable. */
const MAX_PAGES = 5

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid video prompt' }, { status: 400 })
  }

  const credentials = await getPublisherAiCredentials(publisherId)
  if (!isAiConfigured(credentials)) {
    return NextResponse.json({ error: 'Add an OpenRouter API key in Settings to use AI video.' }, { status: 400 })
  }

  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  const result = await generateAiVideoBrief(
    {
      title: book.title ?? 'Untitled book',
      author: book.author,
      blurb: book.blurb,
      bullets: book.bullets,
      categories: book.categories,
      cta: spec.script.cta,
      pageCount: Math.min(book.interiorImageUrls.length, MAX_PAGES),
    },
    { current: parsed.data.current, instruction: parsed.data.instruction, format: spec.format },
    credentials
  )
  return NextResponse.json({ brief: result.data, source: result.source })
}
```

Note: the test expects `cta: 'Buy now'` — `defaultVideoSpec` builds `script.cta` from `ctaText`, so this holds.

- [ ] **Step 4: Verify**

Run: `npx vitest run lib/services/ads/aiVideoBrief.test.ts "app/api/ads/projects/[id]/video/ai/brief" && npx tsc --noEmit`
Expected: PASS; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add lib/services/ads/aiVideoBriefSchema.ts lib/services/ads/aiVideoBrief.ts lib/services/ads/aiVideoBrief.test.ts "app/api/ads/projects/[id]/video/ai/brief"
git commit -m "feat(ads): AI writes and revises an editable shot-by-shot video prompt

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Caption / end-card compositions and the ffmpeg stitch

**Files:**
- Create: `components/trailer/remotion/AiAdParts.tsx`, `lib/services/ads/aiVideoStitch.ts`, `lib/services/ads/aiVideoStitch.test.ts`
- Modify: `remotion/Root.tsx`

**Interfaces:**
- Consumes: `adFontFamily`, `fitFontSize` (Task 3); `AdVideoSpec`, `videoDimensions`, `FPS` (Task 1).
- Produces:
  - Remotion ids `AiCaption` (Still; props `{ spec: AdVideoSpec; caption: string }`) and `AiEndCard` (Composition, 3 s; props `{ spec: AdVideoSpec; coverUrl: string | null; headline: string; cta: string }`)
  - `type StitchInput = { clips: { path: string; durationSec: number; captionPath: string | null }[]; endCardPath: string; endCardSec: number; width: number; height: number; outputPath: string }`
  - `buildStitchArgs(input: StitchInput): string[]`, `stitchAiVideo(input: StitchInput): Promise<void>`, `probeDuration(file: string): Promise<number>`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/services/ads/aiVideoStitch.test.ts
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildStitchArgs, probeDuration, stitchAiVideo } from './aiVideoStitch'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

describe('buildStitchArgs', () => {
  const args = buildStitchArgs({
    clips: [
      { path: 'a.mp4', durationSec: 5, captionPath: 'cap-a.png' },
      { path: 'b.mp4', durationSec: 5, captionPath: null },
    ],
    endCardPath: 'end.mp4',
    endCardSec: 3,
    width: 1920,
    height: 1080,
    outputPath: 'out.mp4',
  })
  const graph = args[args.indexOf('-filter_complex') + 1]

  it('fits every clip to the frame and overlays captions', () => {
    expect(graph).toContain('[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080')
    expect(graph).toContain('[s0][1:v]overlay=0:0')
  })
  it('cross-fades clips into the end card at the right offsets', () => {
    expect(graph).toContain('xfade=transition=fade:duration=0.5:offset=4.50')
    expect(graph).toContain('xfade=transition=fade:duration=0.5:offset=9.00[vout]')
  })
  it('loops the music under the whole video with fades', () => {
    const withMusic = buildStitchArgs({
      clips: [{ path: 'a.mp4', durationSec: 5, captionPath: null }],
      endCardPath: 'end.mp4', endCardSec: 3, width: 1080, height: 1080, outputPath: 'o.mp4', musicPath: 'epic.mp3',
    })
    expect(withMusic.join(' ')).toContain('-stream_loop -1 -i epic.mp3')
    const g = withMusic[withMusic.indexOf('-filter_complex') + 1]
    expect(g).toContain('atrim=duration=7.50,afade=t=in:d=0.5,afade=t=out:st=6.00:d=1.5')
    expect(withMusic).toContain('[aout]')
    expect(withMusic.join(' ')).not.toContain('anullsrc')
  })

  it('maps the video and a silent audio track to the output', () => {
    expect(args).toContain('[vout]')
    expect(args.at(-1)).toBe('out.mp4')
    expect(args.join(' ')).toContain('anullsrc')
  })
})

describe.skipIf(!hasFfmpeg)('stitchAiVideo', () => {
  it('produces one file of the combined length', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'stitch-'))
    try {
      const make = (name: string, colour: string, seconds: number) => {
        const file = path.join(dir, name)
        spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=${colour}:s=320x240:d=${seconds}:r=30`, '-pix_fmt', 'yuv420p', file])
        return file
      }
      const outputPath = path.join(dir, 'out.mp4')
      await stitchAiVideo({
        clips: [
          { path: make('a.mp4', 'red', 2), durationSec: 2, captionPath: null },
          { path: make('b.mp4', 'green', 2), durationSec: 2, captionPath: null },
        ],
        endCardPath: make('end.mp4', 'blue', 2),
        endCardSec: 2,
        width: 640,
        height: 360,
        outputPath,
      })
      expect(await probeDuration(outputPath)).toBeCloseTo(5, 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
```

Run: `npx vitest run lib/services/ads/aiVideoStitch.test.ts`
Expected: FAIL — cannot resolve `./aiVideoStitch`.

- [ ] **Step 2: Implement the stitch**

```ts
// lib/services/ads/aiVideoStitch.ts
import { spawn } from 'node:child_process'

export interface StitchInput {
  clips: { path: string; durationSec: number; captionPath: string | null }[]
  endCardPath: string
  endCardSec: number
  width: number
  height: number
  outputPath: string
  /** Looped under the whole video; silence when null. */
  musicPath?: string | null
}

const FADE_SEC = 0.5

/** Scale/crop every clip to the frame, lay captions over, cross-fade everything into the end card. */
export function buildStitchArgs(input: StitchInput): string[] {
  const { width: w, height: h } = input
  const fit = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30,setsar=1,format=yuv420p`
  const args: string[] = ['-y']
  const filters: string[] = []
  const segments: { label: string; durationSec: number }[] = []
  let next = 0

  input.clips.forEach((clip, i) => {
    args.push('-i', clip.path)
    const video = next++
    filters.push(`[${video}:v]${fit},trim=duration=${clip.durationSec},setpts=PTS-STARTPTS[s${i}]`)
    if (clip.captionPath) {
      args.push('-i', clip.captionPath)
      const caption = next++
      filters.push(`[s${i}][${caption}:v]overlay=0:0:format=auto,format=yuv420p[c${i}]`)
      segments.push({ label: `c${i}`, durationSec: clip.durationSec })
    } else {
      segments.push({ label: `s${i}`, durationSec: clip.durationSec })
    }
  })

  args.push('-i', input.endCardPath)
  const end = next++
  filters.push(`[${end}:v]${fit}[end]`)
  segments.push({ label: 'end', durationSec: input.endCardSec })

  let current = segments[0].label
  let elapsed = segments[0].durationSec
  for (let i = 1; i < segments.length; i++) {
    const out = i === segments.length - 1 ? 'vout' : `x${i}`
    filters.push(`[${current}][${segments[i].label}]xfade=transition=fade:duration=${FADE_SEC}:offset=${(elapsed - FADE_SEC).toFixed(2)}[${out}]`)
    elapsed += segments[i].durationSec - FADE_SEC
    current = out
  }

  if (input.musicPath) {
    args.push('-stream_loop', '-1', '-i', input.musicPath)
    const fadeOutAt = Math.max(0, elapsed - 1.5).toFixed(2)
    filters.push(`[${next}:a]atrim=duration=${elapsed.toFixed(2)},afade=t=in:d=0.5,afade=t=out:st=${fadeOutAt}:d=1.5,volume=0.8[aout]`)
  } else {
    // Several ad placements reject a file with no audio stream.
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100')
  }
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', input.musicPath ? '[aout]' : `${next}:a`, '-shortest',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-movflags', '+faststart',
    input.outputPath
  )
  return args
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
    proc.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
    proc.on('error', (err) => reject(new Error(err.message.includes('ENOENT') ? `${command} is not installed on this server.` : err.message)))
    proc.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${command} failed: ${stderr.trim().slice(-300)}`))))
  })
}

export async function stitchAiVideo(input: StitchInput): Promise<void> {
  await run('ffmpeg', buildStitchArgs(input))
}

/** Clips can come back shorter than requested; trimming to the request would break the fades. */
export async function probeDuration(file: string): Promise<number> {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  return Number(out.trim())
}
```

Run: `npx vitest run lib/services/ads/aiVideoStitch.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Add the caption and end-card compositions**

```tsx
// components/trailer/remotion/AiAdParts.tsx
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { AdVideoSpec } from '@/lib/services/ads/videoSpec'
import { adFontFamily } from './fonts'
import { fitFontSize } from './fit'

export interface AiCaptionProps {
  [key: string]: unknown
  spec: AdVideoSpec
  caption: string
}

/** A transparent caption layer that ffmpeg lays over an AI clip. */
export function AiCaption({ spec, caption }: AiCaptionProps) {
  const { width, height } = useVideoConfig()
  const scale = Math.min(width, height) / 1080
  const { accent, text } = spec.style.colors
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: 80 * scale }}>
      <div
        style={{
          maxWidth: '86%',
          padding: `${18 * scale}px ${36 * scale}px`,
          borderRadius: 24 * scale,
          background: 'rgba(0, 0, 0, 0.55)',
          borderLeft: `${6 * scale}px solid ${accent}`,
          color: text,
          fontFamily: adFontFamily(spec.style.font),
          fontWeight: 700,
          fontSize: fitFontSize(64 * scale, caption, 24),
          lineHeight: 1.15,
          textAlign: 'center',
        }}
      >
        {caption}
      </div>
    </AbsoluteFill>
  )
}

export interface AiEndCardProps {
  [key: string]: unknown
  spec: AdVideoSpec
  coverUrl: string | null
  headline: string
  cta: string
}

/** The closing card: the real cover and real text, never drawn by the video model. */
export function AiEndCard({ spec, coverUrl, headline, cta }: AiEndCardProps) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const scale = Math.min(width, height) / 1080
  const isRow = width >= height
  const shown = spring({ frame, fps, config: { damping: 16 } })
  const { bgFrom, bgTo, accent, text } = spec.style.colors
  const family = adFontFamily(spec.style.font)
  const coverH = Math.round(height * (isRow ? 0.62 : 0.42))

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`,
        flexDirection: isRow ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 60 * scale,
        padding: 60 * scale,
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
      }}
    >
      {coverUrl && (
        <Img
          src={coverUrl}
          style={{
            height: coverH,
            width: Math.round((coverH * 2) / 3),
            objectFit: 'cover',
            borderRadius: 12 * scale,
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8)',
            transform: `scale(${interpolate(shown, [0, 1], [0.9, 1])})`,
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isRow ? 'flex-start' : 'center',
          textAlign: isRow ? 'left' : 'center',
          maxWidth: isRow ? '45%' : '86%',
          gap: 28 * scale,
          opacity: shown,
        }}
      >
        <div style={{ color: text, fontFamily: family, fontWeight: 700, fontSize: fitFontSize(64 * scale, headline, 28), lineHeight: 1.15 }}>
          {headline}
        </div>
        <div style={{ padding: `${16 * scale}px ${36 * scale}px`, borderRadius: 999, background: accent, color: bgTo, fontFamily: family, fontWeight: 700, fontSize: Math.round(34 * scale) }}>
          {cta}
        </div>
      </div>
    </AbsoluteFill>
  )
}
```

`remotion/Root.tsx` — import `Still` alongside `Composition`, import `AiCaption`, `AiEndCard` from `'../components/trailer/remotion/AiAdParts'`, wrap the return in a fragment and add after the `AdVideo` composition:

```tsx
      <Still
        id="AiCaption"
        component={AiCaption}
        width={1920}
        height={1080}
        defaultProps={{ spec: defaults.spec, caption: 'Caption' }}
        calculateMetadata={({ props }) => videoDimensions(props.spec.format)}
      />
      <Composition
        id="AiEndCard"
        component={AiEndCard}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={3 * FPS}
        defaultProps={{ spec: defaults.spec, coverUrl: null, headline: 'Headline', cta: 'Get your copy' }}
        calculateMetadata={({ props }) => videoDimensions(props.spec.format)}
      />
```

- [ ] **Step 4: Verify**

Run: `npm run remotion:bundle && npx tsc --noEmit && npx vitest run lib/services/ads/aiVideoStitch.test.ts`
Expected: bundle written; tsc prints nothing; PASS.

- [ ] **Step 5: Commit**

```bash
git add components/trailer/remotion/AiAdParts.tsx remotion/Root.tsx lib/services/ads/aiVideoStitch.ts lib/services/ads/aiVideoStitch.test.ts
git commit -m "feat(ads): caption/end-card compositions and ffmpeg stitch for AI videos

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: AI video jobs (DB, service, routes)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260923130000_ai_video_jobs/migration.sql`
- Create: `lib/services/ads/aiVideoJob.ts`, `lib/services/ads/aiVideoJob.test.ts`
- Create: `app/api/ads/projects/[id]/video/ai/route.ts`, `app/api/ads/projects/[id]/video/ai/route.test.ts`

**Interfaces:**
- Consumes: Task 9 client; `renderAdVideo`, `renderStillPng` (Task 6); `stitchAiVideo`, `probeDuration` (Task 11); `inlineImage` (Task 6); `aiVideoBriefSchema`, `type AiVideoBrief` (Task 10); `readVideoSpec`, `bookVideoSource`, `videoDimensions` (Task 1); `getVideoModelName` (Task 9).
- Produces:
  - `type ShotState = { jobId: string; durationSec: number; status: 'pending' | 'in_progress' | 'completed' | 'failed'; clipUrl: string | null; error?: string }`
  - `class AiVideoUserError extends Error`
  - `startAiVideoJob(book: Book, brief: AiVideoBrief, apiKey: string): Promise<AiVideoJob>`
  - `advanceAiVideoJob(job: AiVideoJob, book: Book, apiKey: string, publisherId: string): Promise<AiVideoJob>`
  - `summarizeJob(job: AiVideoJob): AiVideoJobSummary` where `AiVideoJobSummary = { id: string; status: string; videoUrl: string | null; posterUrl: string | null; error: string | null; costUsd: number | null; shots: { status: ShotState['status']; durationSec: number }[] }`
  - `POST /api/ads/projects/:id/video/ai` body `{ brief: AiVideoBrief }` → `202 { job }` | `400 { error }` | `404` | `500 { error }`
  - `GET /api/ads/projects/:id/video/ai` → `200 { job: AiVideoJobSummary | null; aiConfigured: boolean; model: { id, pricePerSecond, durations, aspectRatios } | null }`

- [ ] **Step 1: Schema and migration**

`prisma/schema.prisma` — in `model Book` after `videoSpec` add:

```prisma
  aiVideoBrief      Json?
  aiVideoJobs       AiVideoJob[]
```

and add the model at the end of the file:

```prisma
model AiVideoJob {
  id        String   @id @default(cuid())
  bookId    String
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  status    String   @default("running")
  model     String
  format    String
  brief     Json
  shots     Json
  videoUrl  String?
  posterUrl String?
  error     String?
  costUsd   Float?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([bookId])
}
```

`prisma/migrations/20260923130000_ai_video_jobs/migration.sql`:

```sql
-- AI video: the brief the publisher last generated from, and one row per generation.
ALTER TABLE "Book" ADD COLUMN "aiVideoBrief" JSONB;

CREATE TABLE "AiVideoJob" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "model" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "brief" JSONB NOT NULL,
    "shots" JSONB NOT NULL,
    "videoUrl" TEXT,
    "posterUrl" TEXT,
    "error" TEXT,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiVideoJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiVideoJob_bookId_idx" ON "AiVideoJob"("bookId");

ALTER TABLE "AiVideoJob" ADD CONSTRAINT "AiVideoJob_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Run:

```bash
npx prisma validate
npx dotenv -e .env.local -- prisma migrate deploy
npx prisma generate
npx dotenv -e .env.local -- prisma migrate status
```

Expected: schema valid; migration applied; client generated; status "Database schema is up to date!".

- [ ] **Step 2: Write the failing service tests**

```ts
// lib/services/ads/aiVideoJob.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiVideoBrief } from './aiVideoBriefSchema'

vi.mock('@/lib/db', () => ({
  prisma: {
    aiVideoJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(async ({ data }: any) => ({ id: 'job_1', status: 'running', videoUrl: null, posterUrl: null, error: null, ...data })),
      update: vi.fn(async ({ data }: any) => ({ id: 'job_1', ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    book: { update: vi.fn(async () => ({})) },
  },
}))
vi.mock('@/lib/providers/aiVideo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/providers/aiVideo')>()),
  getVideoModelInfo: vi.fn(),
  submitVideoJob: vi.fn(),
  getVideoJob: vi.fn(),
  downloadVideoJob: vi.fn(),
}))
vi.mock('@/lib/providers/ai', () => ({ getVideoModelName: () => 'kwaivgi/kling-v3.0-std' }))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn(async (p: string) => ({ url: `/api/files/${p}` })),
  readStoredFile: vi.fn(async () => ({ data: Buffer.from('clip'), contentType: 'video/mp4' })),
}))
vi.mock('./videoAssets', () => ({
  inlineImage: vi.fn(async (u: string | null) => (u ? `data:${u}` : null)),
  musicFile: vi.fn(async () => '/app/public/music/epic.mp3'),
}))
vi.mock('./renderVideo', () => ({
  renderStillPng: vi.fn(async () => Buffer.from('png')),
  renderAdVideo: vi.fn(async () => ({ videoBuffer: Buffer.from('end'), posterBuffer: Buffer.from('poster'), durationSec: 3, width: 1920, height: 1080 })),
}))
vi.mock('./aiVideoStitch', () => ({ stitchAiVideo: vi.fn(async () => {}), probeDuration: vi.fn(async () => 5) }))
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: vi.fn(async () => Buffer.from('final')),
}))

import { prisma } from '@/lib/db'
import { getVideoJob, getVideoModelInfo, submitVideoJob, downloadVideoJob } from '@/lib/providers/aiVideo'
import { stitchAiVideo } from './aiVideoStitch'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob, summarizeJob } from './aiVideoJob'

const book: any = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: '/cover.png', interiorImageUrls: ['/p1.png'],
  customHook: null, ctaText: null, videoStyle: null, videoFormat: '16:9', videoLength: null, videoMood: null, videoSpec: null,
}
const brief: AiVideoBrief = {
  shots: [
    { prompt: 'Slow push-in on the cover', sourceImage: 'cover', durationSec: 5, caption: 'Hook' },
    { prompt: 'Drift across the first page', sourceImage: 'page-1', durationSec: 7, caption: '' },
  ],
  endCard: { headline: 'Read it', cta: 'Buy now' },
}
const kling = { id: 'kwaivgi/kling-v3.0-std', durations: [3, 5, 10], aspectRatios: ['16:9', '9:16', '1:1'], resolutions: ['720p'], pricePerSecond: 0.084 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(null)
  vi.mocked(getVideoModelInfo).mockResolvedValue(kling)
  vi.mocked(submitVideoJob).mockResolvedValueOnce('or_1').mockResolvedValueOnce('or_2')
})

describe('startAiVideoJob', () => {
  it('submits one job per shot from the right image at a supported duration', async () => {
    const job = await startAiVideoJob(book, brief, 'sk')
    expect(submitVideoJob).toHaveBeenNthCalledWith(1, expect.objectContaining({ imageUrl: 'data:/cover.png', durationSec: 5, aspectRatio: '16:9', resolution: '720p' }))
    expect(submitVideoJob).toHaveBeenNthCalledWith(2, expect.objectContaining({ imageUrl: 'data:/p1.png', durationSec: 5 }))
    expect(job.costUsd).toBe(0.84)
    expect(prisma.book.update).toHaveBeenCalledWith({ where: { id: 'book_1' }, data: { aiVideoBrief: brief } })
  })

  it('refuses a format the model cannot make', async () => {
    vi.mocked(getVideoModelInfo).mockResolvedValue({ ...kling, aspectRatios: ['16:9', '9:16'] })
    await expect(startAiVideoJob({ ...book, videoFormat: '1:1' }, brief, 'sk')).rejects.toThrow(/can't make 1:1/)
    expect(submitVideoJob).not.toHaveBeenCalled()
  })

  it('refuses while another AI video is running', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue({ id: 'old' } as any)
    await expect(startAiVideoJob(book, brief, 'sk')).rejects.toBeInstanceOf(AiVideoUserError)
  })
})

describe('advanceAiVideoJob', () => {
  const running = (shots: any[]): any => ({ id: 'job_1', bookId: 'book_1', status: 'running', format: '16:9', brief, shots, model: 'm' })

  it('records progress while shots are still rendering', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'in_progress' })
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }]), book, 'sk', 'pub_1')
    expect((job.shots as any)[0].status).toBe('in_progress')
    expect(stitchAiVideo).not.toHaveBeenCalled()
  })

  it('downloads finished clips and stitches once all are done', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'completed' })
    vi.mocked(downloadVideoJob).mockResolvedValue(Buffer.from('mp4'))
    const job = await advanceAiVideoJob(
      running([
        { jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null },
        { jobId: 'or_2', durationSec: 5, status: 'pending', clipUrl: null },
      ]),
      book, 'sk', 'pub_1'
    )
    expect(prisma.aiVideoJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job_1', status: 'running' } }))
    expect(stitchAiVideo).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1920, height: 1080, endCardSec: 3, musicPath: '/app/public/music/epic.mp3' })
    )
    expect(job.status).toBe('completed')
    expect(job.videoUrl).toMatch(/ai-video\/job_1\/ai-video\.mp4$/)
  })

  it('fails the job with the model’s message when a shot fails', async () => {
    vi.mocked(getVideoJob).mockResolvedValue({ status: 'failed', error: 'content policy' })
    const job = await advanceAiVideoJob(running([{ jobId: 'or_1', durationSec: 5, status: 'pending', clipUrl: null }]), book, 'sk', 'pub_1')
    expect(job.status).toBe('failed')
    expect(job.error).toBe('content policy')
  })
})

describe('summarizeJob', () => {
  it('exposes only what the browser needs', () => {
    expect(
      summarizeJob({ id: 'j', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 1, shots: [{ jobId: 'secret', durationSec: 5, status: 'pending', clipUrl: null }] } as any)
    ).toEqual({ id: 'j', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 1, shots: [{ status: 'pending', durationSec: 5 }] })
  })
})
```

Run: `npx vitest run lib/services/ads/aiVideoJob.test.ts`
Expected: FAIL — cannot resolve `./aiVideoJob`.

- [ ] **Step 3: Implement the service**

```ts
// lib/services/ads/aiVideoJob.ts
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { AiVideoJob, Book, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getVideoModelName } from '@/lib/providers/ai'
import { readStoredFile, storeFile } from '@/lib/providers/storage'
import {
  downloadVideoJob,
  getVideoJob,
  getVideoModelInfo,
  pickDuration,
  pickResolution,
  submitVideoJob,
} from '@/lib/providers/aiVideo'
import type { AiVideoBrief } from './aiVideoBriefSchema'
import { bookVideoSource, readVideoSpec, resolveMusic, videoDimensions, type AdVideoSpec } from './videoSpec'
import { inlineImage, musicFile } from './videoAssets'
import { renderAdVideo, renderStillPng } from './renderVideo'
import { probeDuration, stitchAiVideo } from './aiVideoStitch'

export type ShotState = {
  jobId: string
  durationSec: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  clipUrl: string | null
  error?: string
}

export interface AiVideoJobSummary {
  id: string
  status: string
  videoUrl: string | null
  posterUrl: string | null
  error: string | null
  costUsd: number | null
  shots: { status: ShotState['status']; durationSec: number }[]
}

/** A problem the publisher can fix; routes return it as a 400 with this message. */
export class AiVideoUserError extends Error {}

const json = (value: unknown) => value as Prisma.InputJsonValue

function sourceImageUrl(book: Book, key: string): string | null {
  if (key === 'cover') return book.frontCoverUrl
  return book.interiorImageUrls[Number(key.replace('page-', '')) - 1] ?? null
}

export async function startAiVideoJob(book: Book, brief: AiVideoBrief, apiKey: string): Promise<AiVideoJob> {
  const active = await prisma.aiVideoJob.findFirst({ where: { bookId: book.id, status: { in: ['running', 'stitching'] } } })
  if (active) throw new AiVideoUserError('An AI video is already being made for this book. Wait for it to finish.')

  const model = getVideoModelName()
  const spec = readVideoSpec(book.videoSpec, bookVideoSource(book))
  const info = await getVideoModelInfo(model, apiKey)
  if (info && info.aspectRatios.length > 0 && !info.aspectRatios.includes(spec.format)) {
    throw new AiVideoUserError(
      `${model} can't make ${spec.format} videos. Switch the Instant Video format to ${info.aspectRatios.join(' or ')}, save, and try again.`
    )
  }

  // ponytail: shots submitted one after another; a failure midway leaves earlier
  // jobs running (and billed) with no row. Submission takes seconds, so accepted.
  const shots: ShotState[] = []
  for (const shot of brief.shots) {
    const imageUrl = await inlineImage(sourceImageUrl(book, shot.sourceImage))
    if (!imageUrl) throw new AiVideoUserError(`The image for “${shot.sourceImage}” could not be read. Choose another image for that shot.`)
    const durationSec = pickDuration(shot.durationSec, info?.durations ?? [])
    const jobId = await submitVideoJob({
      apiKey,
      model,
      prompt: shot.prompt,
      imageUrl,
      durationSec,
      aspectRatio: spec.format,
      resolution: pickResolution(info?.resolutions ?? []),
    })
    shots.push({ jobId, durationSec, status: 'pending', clipUrl: null })
  }

  const seconds = shots.reduce((total, s) => total + s.durationSec, 0)
  await prisma.book.update({ where: { id: book.id }, data: { aiVideoBrief: json(brief) } })
  return prisma.aiVideoJob.create({
    data: {
      bookId: book.id,
      model,
      format: spec.format,
      brief: json(brief),
      shots: json(shots),
      costUsd: info?.pricePerSecond ? Math.round(seconds * info.pricePerSecond * 100) / 100 : null,
    },
  })
}

export async function advanceAiVideoJob(job: AiVideoJob, book: Book, apiKey: string, publisherId: string): Promise<AiVideoJob> {
  if (job.status !== 'running') return job
  const shots = job.shots as unknown as ShotState[]
  const dir = `ads/${publisherId}/ai-video/${job.id}`

  await Promise.all(
    shots.map(async (shot, i) => {
      if (shot.status === 'completed' || shot.status === 'failed') return
      const remote = await getVideoJob(apiKey, shot.jobId)
      if (remote.status === 'completed') {
        const clip = await downloadVideoJob(apiKey, shot.jobId)
        shot.clipUrl = (await storeFile(`${dir}/shot-${i + 1}.mp4`, clip, 'video/mp4')).url
        shot.status = 'completed'
      } else if (remote.status === 'failed' || remote.status === 'cancelled' || remote.status === 'expired') {
        shot.status = 'failed'
        shot.error = remote.error ?? `The video model reported “${remote.status}”.`
      } else {
        shot.status = remote.status === 'in_progress' ? 'in_progress' : 'pending'
      }
    })
  )

  const failed = shots.find((s) => s.status === 'failed')
  if (failed) {
    return prisma.aiVideoJob.update({ where: { id: job.id }, data: { shots: json(shots), status: 'failed', error: failed.error } })
  }
  if (!shots.every((s) => s.status === 'completed')) {
    return prisma.aiVideoJob.update({ where: { id: job.id }, data: { shots: json(shots) } })
  }

  // Claim the stitch so two polls arriving together do not both render it.
  const claim = await prisma.aiVideoJob.updateMany({ where: { id: job.id, status: 'running' }, data: { shots: json(shots), status: 'stitching' } })
  if (claim.count === 0) return (await prisma.aiVideoJob.findUnique({ where: { id: job.id } })) ?? job

  try {
    const { videoUrl, posterUrl } = await stitchJob(job, shots, book, dir)
    return prisma.aiVideoJob.update({ where: { id: job.id }, data: { status: 'completed', videoUrl, posterUrl } })
  } catch (err) {
    console.error('ai video stitch failed', err)
    return prisma.aiVideoJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: err instanceof Error ? err.message : 'Putting the video together failed.' },
    })
  }
}

async function stitchJob(job: AiVideoJob, shots: ShotState[], book: Book, dir: string) {
  const brief = job.brief as unknown as AiVideoBrief
  const spec: AdVideoSpec = { ...readVideoSpec(book.videoSpec, bookVideoSource(book)), format: job.format as AdVideoSpec['format'] }
  const { width, height } = videoDimensions(spec.format)
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ai-video-'))
  try {
    // Sequential: each still render starts a browser.
    const clips = []
    for (const [i, shot] of shots.entries()) {
      const clipPath = path.join(tmp, `shot-${i}.mp4`)
      await writeFile(clipPath, (await readStoredFile(shot.clipUrl!)).data)
      const caption = brief.shots[i]?.caption?.trim()
      let captionPath: string | null = null
      if (caption) {
        captionPath = path.join(tmp, `caption-${i}.png`)
        await writeFile(captionPath, await renderStillPng({ spec, caption }, 'AiCaption'))
      }
      clips.push({ path: clipPath, durationSec: Math.min(shot.durationSec, await probeDuration(clipPath)), captionPath })
    }

    const endCard = await renderAdVideo(
      { spec, coverUrl: await inlineImage(book.frontCoverUrl), headline: brief.endCard.headline, cta: brief.endCard.cta },
      'AiEndCard'
    )
    const endCardPath = path.join(tmp, 'end.mp4')
    await writeFile(endCardPath, endCard.videoBuffer)

    const outputPath = path.join(tmp, 'final.mp4')
    await stitchAiVideo({
      clips,
      endCardPath,
      endCardSec: endCard.durationSec,
      width,
      height,
      outputPath,
      musicPath: await musicFile(resolveMusic(spec), tmp),
    })

    const [video, poster] = await Promise.all([
      storeFile(`${dir}/ai-video.mp4`, await readFile(outputPath), 'video/mp4'),
      storeFile(`${dir}/ai-poster.png`, endCard.posterBuffer, 'image/png'),
    ])
    return { videoUrl: video.url, posterUrl: poster.url }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

export function summarizeJob(job: AiVideoJob): AiVideoJobSummary {
  const shots = job.shots as unknown as ShotState[]
  return {
    id: job.id,
    status: job.status,
    videoUrl: job.videoUrl,
    posterUrl: job.posterUrl,
    error: job.error,
    costUsd: job.costUsd,
    shots: shots.map((s) => ({ status: s.status, durationSec: s.durationSec })),
  }
}
```

Run: `npx vitest run lib/services/ads/aiVideoJob.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 4: Write the failing route tests**

```ts
// app/api/ads/projects/[id]/video/ai/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fallbackBrief } from '@/lib/services/ads/aiVideoBriefSchema'

const book = { id: 'book_1', title: 'T' }
const jobRow = { id: 'job_1', status: 'running', videoUrl: null, posterUrl: null, error: null, costUsd: 0.84, shots: [] }

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/publisher/settings', () => ({ getPublisherAiCredentials: vi.fn() }))
vi.mock('@/lib/providers/ai', () => ({
  resolveApiKey: (c?: { apiKey?: string | null }) => c?.apiKey || undefined,
  getVideoModelName: () => 'kwaivgi/kling-v3.0-std',
}))
vi.mock('@/lib/providers/aiVideo', () => ({ getVideoModelInfo: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({ prisma: { aiVideoJob: { findFirst: vi.fn() } } }))
vi.mock('@/lib/services/ads/aiVideoJob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/ads/aiVideoJob')>()
  return { AiVideoUserError: actual.AiVideoUserError, summarizeJob: actual.summarizeJob, startAiVideoJob: vi.fn(), advanceAiVideoJob: vi.fn() }
})

import { GET, POST } from './route'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { prisma } from '@/lib/db'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob } from '@/lib/services/ads/aiVideoJob'

const ctx = { params: Promise.resolve({ id: 'book_1' }) }
const post = (body: unknown) => new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const brief = fallbackBrief({ title: 'T', pageCount: 0 })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
  vi.mocked(getPublisherAiCredentials).mockResolvedValue({ apiKey: 'sk', model: null })
})

describe('POST /api/ads/projects/:id/video/ai', () => {
  it('starts a job from the edited brief', async () => {
    vi.mocked(startAiVideoJob).mockResolvedValue(jobRow as any)
    const res = await POST(post({ brief }), ctx)
    expect(res.status).toBe(202)
    expect(startAiVideoJob).toHaveBeenCalledWith(book, brief, 'sk')
    expect((await res.json()).job.id).toBe('job_1')
  })
  it('explains fixable problems as 400s', async () => {
    vi.mocked(startAiVideoJob).mockRejectedValue(new AiVideoUserError("can't make 1:1 videos"))
    const res = await POST(post({ brief }), ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/1:1/)
  })
  it('rejects an invalid brief and a missing key', async () => {
    expect((await POST(post({ brief: { shots: [] } }), ctx)).status).toBe(400)
    vi.mocked(getPublisherAiCredentials).mockResolvedValue({ apiKey: null, model: null })
    expect((await POST(post({ brief }), ctx)).status).toBe(400)
  })
})

describe('GET /api/ads/projects/:id/video/ai', () => {
  it('advances and returns the latest job', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(jobRow as any)
    vi.mocked(advanceAiVideoJob).mockResolvedValue({ ...jobRow, status: 'completed', videoUrl: '/v.mp4' } as any)
    const res = await GET(new Request('http://localhost'), ctx)
    const body = await res.json()
    expect(body.aiConfigured).toBe(true)
    expect(body.job).toMatchObject({ id: 'job_1', status: 'completed', videoUrl: '/v.mp4' })
  })
  it('returns no job when none exists', async () => {
    vi.mocked(prisma.aiVideoJob.findFirst).mockResolvedValue(null)
    expect((await (await GET(new Request('http://localhost'), ctx)).json()).job).toBeNull()
  })
})
```

Run: `npx vitest run "app/api/ads/projects/[id]/video/ai/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 5: Implement the route**

```ts
// app/api/ads/projects/[id]/video/ai/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getPublisherAiCredentials } from '@/lib/publisher/settings'
import { getVideoModelName, resolveApiKey } from '@/lib/providers/ai'
import { getVideoModelInfo } from '@/lib/providers/aiVideo'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { aiVideoBriefSchema } from '@/lib/services/ads/aiVideoBriefSchema'
import { AiVideoUserError, advanceAiVideoJob, startAiVideoJob, summarizeJob } from '@/lib/services/ads/aiVideoJob'
import { prisma } from '@/lib/db'

// Stitching (captions, end card, ffmpeg) happens inside a poll.
export const maxDuration = 300

const bodySchema = z.object({ brief: aiVideoBriefSchema })
const NO_KEY = 'Add an OpenRouter API key in Settings to use AI video.'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the video prompt' }, { status: 400 })
  }
  const apiKey = resolveApiKey(await getPublisherAiCredentials(publisherId))
  if (!apiKey) return NextResponse.json({ error: NO_KEY }, { status: 400 })

  try {
    const job = await startAiVideoJob(book, parsed.data.brief, apiKey)
    return NextResponse.json({ job: summarizeJob(job) }, { status: 202 })
  } catch (err) {
    if (err instanceof AiVideoUserError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('ai video start failed', err)
    const message = err instanceof Error ? err.message : 'The AI video could not be started.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const apiKey = resolveApiKey(await getPublisherAiCredentials(publisherId))
  const latest = await prisma.aiVideoJob.findFirst({ where: { bookId: book.id }, orderBy: { createdAt: 'desc' } })
  const job = latest && apiKey ? await advanceAiVideoJob(latest, book, apiKey, publisherId) : latest
  const info = apiKey ? await getVideoModelInfo(getVideoModelName(), apiKey) : null

  return NextResponse.json({
    job: job ? summarizeJob(job) : null,
    aiConfigured: Boolean(apiKey),
    model: info && { id: info.id, pricePerSecond: info.pricePerSecond, durations: info.durations, aspectRatios: info.aspectRatios },
  })
}
```

- [ ] **Step 6: Verify**

Run: `npx vitest run lib/services/ads "app/api/ads" && npx tsc --noEmit`
Expected: PASS (except DB-backed `queries.test.ts`); tsc prints nothing.

- [ ] **Step 7: Commit**

```bash
git add prisma "app/api/ads/projects/[id]/video/ai/route.ts" "app/api/ads/projects/[id]/video/ai/route.test.ts" lib/services/ads/aiVideoJob.ts lib/services/ads/aiVideoJob.test.ts
git commit -m "feat(ads): AI video jobs — submit shots, poll, stitch with real end card

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: AI Video panel (cyan) on the results page

**Files:**
- Create: `components/ads/AiVideoPanel.tsx`
- Modify: `app/(platform)/ads/[projectId]/results/page.tsx`
- Test: `e2e/ads-ai-video.spec.ts`

**Interfaces:**
- Consumes: `POST …/video/ai/brief`, `POST|GET …/video/ai` (Tasks 10, 12); `aiVideoBriefSchema`, `BRIEF_LIMITS`, `type AiVideoBrief` (Task 10); `pickDuration` (Task 9); `type AiVideoJobSummary` (Task 12, import type only).
- Produces: `AiVideoPanel({ projectId, coverUrl, pageUrls, initialBrief })`.

- [ ] **Step 1: Write the failing end-to-end test** (no paid generation; it stops before "Generate AI video")

```ts
// e2e/ads-ai-video.spec.ts
import { test, expect } from '@playwright/test'

const PROJECT = process.env.E2E_ADS_PROJECT_ID
test.skip(!PROJECT, 'Set E2E_ADS_PROJECT_ID to a generated ads project')

test('the cyan button opens an editable AI video prompt', async ({ page }) => {
  await page.goto(`/ads/${PROJECT}/results`)
  await page.getByRole('button', { name: 'Generate with AI' }).click()
  const panel = page.getByRole('region', { name: 'AI Video' })
  await expect(panel).toBeVisible()

  await panel.getByRole('button', { name: /Write the video prompt/ }).click()
  const firstPrompt = panel.getByLabel('Shot 1 prompt')
  await expect(firstPrompt).not.toHaveValue('', { timeout: 60_000 })

  await firstPrompt.fill('Slow push-in on the cover while golden light sweeps across it')
  await expect(panel.getByRole('button', { name: 'Generate AI video' })).toBeEnabled()
  await expect(panel.getByText(/≈ \$\d+\.\d\d/)).toBeVisible()
})
```

Run: `E2E_ADS_PROJECT_ID=cmud6xbkz0001ias68l1q7el8 npx playwright test e2e/ads-ai-video.spec.ts`
Expected: FAIL — no "Generate with AI" button.

- [ ] **Step 2: Create the panel**

```tsx
// components/ads/AiVideoPanel.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clapperboard, Download, Loader2, Plus, Sparkles, Wand2, X } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { BRIEF_LIMITS, aiVideoBriefSchema, type AiVideoBrief } from '@/lib/services/ads/aiVideoBriefSchema'
import { pickDuration } from '@/lib/providers/aiVideo'
import type { AiVideoJobSummary } from '@/lib/services/ads/aiVideoJob'

interface ModelInfo {
  id: string
  pricePerSecond: number | null
  durations: number[]
  aspectRatios: string[]
}

export interface AiVideoPanelProps {
  projectId: string
  coverUrl: string | null
  pageUrls: string[]
  initialBrief: AiVideoBrief | null
}

const ACTIVE = new Set(['running', 'stitching'])
const inputClass =
  'w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-ai focus:ring-2 focus:ring-ai/25'
const labelClass = 'flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted'

export function AiVideoPanel({ projectId, coverUrl, pageUrls, initialBrief }: AiVideoPanelProps) {
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState<AiVideoBrief | null>(initialBrief)
  const [instruction, setInstruction] = useState('')
  const [writing, setWriting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [job, setJob] = useState<AiVideoJobSummary | null>(null)
  const [model, setModel] = useState<ModelInfo | null>(null)
  const [aiConfigured, setAiConfigured] = useState(true)

  const images = [{ key: 'cover', label: 'Cover', url: coverUrl }, ...pageUrls.slice(0, 5).map((url, i) => ({ key: `page-${i + 1}`, label: `Page ${i + 1}`, url }))]
  const durations = (model?.durations.length ? model.durations : [4, 5, 6, 8]).filter((d) => d >= 3 && d <= 10)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/ads/projects/${projectId}/video/ai`)
    if (!res.ok) return
    const body = await res.json()
    setJob(body.job)
    setModel(body.model)
    setAiConfigured(body.aiConfigured)
  }, [projectId])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!job || !ACTIVE.has(job.status)) return
    const timer = setInterval(() => void refresh(), 5000)
    return () => clearInterval(timer)
  }, [job, refresh])

  const check = brief ? aiVideoBriefSchema.safeParse(brief) : null
  const problem = check && !check.success ? check.error.issues[0]?.message : null
  const seconds = brief ? brief.shots.reduce((t, s) => t + pickDuration(s.durationSec, model?.durations ?? []), 0) : 0
  const estimate = model?.pricePerSecond ? seconds * model.pricePerSecond : null
  const busy = Boolean(job && ACTIVE.has(job.status))

  async function writeBrief(revise: boolean) {
    setWriting(true)
    const res = await fetch(`/api/ads/projects/${projectId}/video/ai/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: revise ? brief : undefined, instruction: instruction || undefined }),
    })
    const body = await res.json().catch(() => ({}))
    setWriting(false)
    if (!res.ok) {
      toast.error(body.error ?? 'The AI could not write the prompt.')
      return
    }
    setBrief(body.brief)
    if (body.source === 'fallback') toast.warning('AI was unavailable, so a starter prompt was filled in. Edit it before generating.')
    setInstruction('')
  }

  async function generate() {
    if (!check?.success) return
    setStarting(true)
    const res = await fetch(`/api/ads/projects/${projectId}/video/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: check.data }),
    })
    const body = await res.json().catch(() => ({}))
    setStarting(false)
    if (!res.ok) {
      toast.error(body.error ?? 'The AI video could not be started.')
      return
    }
    setJob(body.job)
    toast.success('AI video started', { description: 'Each shot takes a few minutes. You can keep working.' })
  }

  const setShot = (i: number, patch: Partial<AiVideoBrief['shots'][number]>) =>
    setBrief((b) => b && { ...b, shots: b.shots.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-3xl border border-ai/30 bg-ai-soft p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Want something more cinematic?</p>
          <p className="text-sm text-ink-muted">An AI video made from your cover and pages. You review and edit the prompt first.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)} className="bg-ai text-canvas hover:bg-ai/90">
          <Sparkles className="size-4" aria-hidden /> Generate with AI
        </Button>
      </div>
    )
  }

  return (
    <section aria-labelledby="ai-video-title" className="rounded-3xl border border-ai/30 bg-ai-soft p-5 shadow-card sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-ai text-canvas">
            <Clapperboard className="size-5" aria-hidden />
          </span>
          <div>
            <h3 id="ai-video-title" className="font-display text-lg font-semibold text-ink">AI Video</h3>
            <p className="text-sm text-ink-muted">Each shot animates one of your images. Your real cover and call to action close the video.</p>
          </div>
        </div>
        <button type="button" aria-label="Close AI video" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </header>

      {!aiConfigured && (
        <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          AI video needs an OpenRouter API key. <a href="/settings" className="font-semibold underline">Add it in Settings</a>.
        </p>
      )}

      {job && (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
          {job.status === 'completed' && job.videoUrl ? (
            <div className="flex flex-col gap-3">
              <video controls playsInline poster={job.posterUrl ?? undefined} src={job.videoUrl} className="max-h-[70vh] w-full rounded-xl bg-black object-contain" />
              <a href={job.videoUrl} download="ai-video-ad.mp4" className={cn(buttonClasses({ size: 'sm' }), 'self-start bg-ai text-canvas hover:bg-ai/90')}>
                <Download className="size-3.5" aria-hidden /> Download AI video
              </a>
            </div>
          ) : job.status === 'failed' ? (
            <p role="alert" className="text-sm text-danger">The AI video didn’t finish: {job.error}. Edit the prompt and generate again.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <Loader2 className="size-4 animate-spin text-ai" aria-hidden />
                {job.status === 'stitching' ? 'Putting your video together…' : 'The AI is animating your shots. This takes a few minutes.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {job.shots.map((shot, i) => (
                  <span key={i} className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', shot.status === 'completed' ? 'bg-ai text-canvas' : 'bg-surface-2 text-ink-muted')}>
                    Shot {i + 1}: {shot.status === 'completed' ? 'done' : shot.status === 'in_progress' ? 'animating' : 'queued'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!brief ? (
        <div className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Direction for the AI (optional)</span>
            <input className={inputClass} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. warm and magical, start with the cover" />
          </label>
          <Button type="button" onClick={() => writeBrief(false)} loading={writing} disabled={writing || !aiConfigured} className="self-start bg-ai text-canvas hover:bg-ai/90">
            <Wand2 className="size-4" aria-hidden /> Write the video prompt
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {brief.shots.map((shot, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">Shot {i + 1}</span>
                {brief.shots.length > 1 && (
                  <button type="button" aria-label={`Remove shot ${i + 1}`} onClick={() => setBrief({ ...brief, shots: brief.shots.filter((_, j) => j !== i) })} className="text-ink-muted hover:text-danger">
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={`Shot ${i + 1} image`}>
                {images.map((image) => (
                  <button
                    key={image.key}
                    type="button"
                    role="radio"
                    aria-checked={shot.sourceImage === image.key}
                    onClick={() => setShot(i, { sourceImage: image.key })}
                    className={cn('flex items-center gap-2 rounded-xl border px-2 py-1 text-xs transition', shot.sourceImage === image.key ? 'border-ai ring-2 ring-ai/30' : 'border-line hover:border-ai/50')}
                  >
                    {image.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt="" className="h-8 w-6 rounded object-cover" />
                    )}
                    {image.label}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex flex-col gap-1.5">
                <span className={labelClass}>What happens <span className="font-normal normal-case">{shot.prompt.length}/{BRIEF_LIMITS.prompt}</span></span>
                <textarea aria-label={`Shot ${i + 1} prompt`} rows={3} className={inputClass} value={shot.prompt} onChange={(e) => setShot(i, { prompt: e.target.value })} />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Length</span>
                  <select className={inputClass} value={pickDuration(shot.durationSec, durations)} onChange={(e) => setShot(i, { durationSec: Number(e.target.value) })}>
                    {durations.map((d) => (
                      <option key={d} value={d}>{d} seconds</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Caption (optional) <span className="font-normal normal-case">{shot.caption.length}/{BRIEF_LIMITS.caption}</span></span>
                  <input className={inputClass} value={shot.caption} onChange={(e) => setShot(i, { caption: e.target.value })} />
                </label>
              </div>
            </div>
          ))}

          {brief.shots.length < BRIEF_LIMITS.shots && (
            <button
              type="button"
              onClick={() => setBrief({ ...brief, shots: [...brief.shots, { prompt: '', sourceImage: 'cover', durationSec: 5, caption: '' }] })}
              className="inline-flex items-center gap-1 self-start text-sm font-medium text-ai hover:underline"
            >
              <Plus className="size-3.5" aria-hidden /> Add a shot
            </button>
          )}

          <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>End card headline <span className="font-normal normal-case">{brief.endCard.headline.length}/{BRIEF_LIMITS.headline}</span></span>
              <input className={inputClass} value={brief.endCard.headline} onChange={(e) => setBrief({ ...brief, endCard: { ...brief.endCard, headline: e.target.value } })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Call to action <span className="font-normal normal-case">{brief.endCard.cta.length}/{BRIEF_LIMITS.cta}</span></span>
              <input className={inputClass} value={brief.endCard.cta} onChange={(e) => setBrief({ ...brief, endCard: { ...brief.endCard, cta: e.target.value } })} />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={inputClass} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Tell the AI what to change, e.g. darker mood, open on page 2" aria-label="Revision instruction" />
            <Button type="button" variant="secondary" onClick={() => writeBrief(true)} loading={writing} disabled={writing || !aiConfigured} className="shrink-0">
              <Wand2 className="size-4" aria-hidden /> Revise with AI
            </Button>
          </div>

          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ai/20 pt-4">
            <p className="text-sm text-ink-muted">
              {estimate !== null ? `≈ $${estimate.toFixed(2)} · ${seconds} seconds of AI video` : `${seconds} seconds of AI video`}
              {model ? ` · ${model.id}` : ''}
            </p>
            <Button type="button" onClick={generate} loading={starting} disabled={starting || busy || Boolean(problem) || !aiConfigured} className="bg-ai text-canvas hover:bg-ai/90">
              <Sparkles className="size-4" aria-hidden /> Generate AI video
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Add it to the results page**

In `app/(platform)/ads/[projectId]/results/page.tsx`:

```tsx
import { AiVideoPanel } from '@/components/ads/AiVideoPanel'
import { aiVideoBriefSchema } from '@/lib/services/ads/aiVideoBriefSchema'
```

After the `videoSpec` constant add `const savedBrief = aiVideoBriefSchema.safeParse(book.aiVideoBrief)`, and directly after the `<InstantVideoCard … />` element (inside the same `includeVideo` condition, wrapped in a fragment) add:

```tsx
          <AiVideoPanel
            projectId={book.id}
            coverUrl={book.frontCoverUrl}
            pageUrls={book.interiorImageUrls}
            initialBrief={savedBrief.success ? savedBrief.data : null}
          />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && E2E_ADS_PROJECT_ID=cmud6xbkz0001ias68l1q7el8 npx playwright test e2e/ads-ai-video.spec.ts e2e/ads-instant-video.spec.ts`
Expected: tsc prints nothing; all PASS (the brief call spends a fraction of a cent on the text model).

Look at screenshots of the collapsed and opened panel, in light and dark mode.

- [ ] **Step 5: Commit**

```bash
git add components/ads/AiVideoPanel.tsx "app/(platform)/ads/[projectId]/results/page.tsx" e2e/ads-ai-video.spec.ts
git commit -m "feat(ads): cyan AI Video panel with editable shot prompts and progress

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Final verification

- [ ] **Step 1: Full checks**

```bash
npx tsc --noEmit
npx vitest run 2>&1 | tail -8
npm run remotion:bundle
grep -rniE "remotion|hyperframe" --include=*.tsx components app | grep -vE "from '|import |@remotion|remotion/|\{/\*|^\S+:\s*//"
```

Expected: tsc clean; vitest failures limited to the DB-backed `queries.test.ts` files (`DATABASE_URL`); bundle written; the grep prints nothing.

- [ ] **Step 2: Paid end-to-end AI video check — ask first**

Ask the user: "Run one real AI video now to confirm the whole path? It costs about $0.85 (two 5-second Kling shots)." Only on yes: in the results page, write the prompt, generate, wait for completion, download, and check with `ffprobe` that the file has one video stream at the format's size, an audio stream, and a duration of about shots + 3 s end card − 0.5 s per fade.

- [ ] **Step 3: Report**

Summarise to the user what changed, what was verified (and what was not), the cost of anything paid, and the `.env.local` model change.
