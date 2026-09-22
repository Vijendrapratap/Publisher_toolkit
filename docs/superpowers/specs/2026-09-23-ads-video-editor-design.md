# Ads Creative: editable video script, fonts & colours, WYSIWYG export

Date: 2026-09-23 · Status: revision 2, awaiting review

## Problem

In the Ads Creative flow (`/ads/[id]/configure → generate → results`):

1. **Layout breaks.** The configure page squeezes the Remotion preview into a
   narrow column (ratio buttons and scene buttons clipped, player mostly empty).
   The results page packs creatives three-across in a narrow column ("Download"
   clipped to "Dowr") and the video card title wraps one word per line.
2. **Preview ≠ export.** The preview is `components/trailer/remotion/BookTrailerComposition.tsx`
   (fixed 10 s). The MP4 comes from a separate canvas renderer,
   `lib/services/trailer/video.ts`, which duplicates the palettes by hand and
   has its own layout — that is where the title text overlaps the cover.
3. **Video text cannot be edited.** The video's hook/lines/CTA are not
   editable anywhere, so a publisher cannot fix a line and re-export.
4. **No AI video option.** Video is a fixed template; there is no way to ask
   an AI for a richer, generated ad built from the same inputs.
5. **Fonts and colours are hard-coded** (system serif/sans, 8 fixed palettes).

## Goals

The publisher adds the book (details, cover, interior pages) and receives ad
images and a video. The results page then offers two ways to refine the video:

- **Instant Video** (light-green card): the video text, font and colours are
  edited in place and the preview updates immediately. Export renders exactly
  what is previewed. Fast, no AI cost.
- **Generate with AI** (cyan button): an AI video built from the same inputs.
  The AI writes an editable, shot-by-shot video prompt; the publisher edits it
  directly or gives pointers for the AI to revise it, then generates the video
  with a video model.

Also:

- No engine names ("Remotion", "Hyperframes") anywhere in the UI.
- The downloaded Instant Video MP4 is a pixel match of its preview.
- The results page lays out cleanly from 1024 px up and stacks on narrow
  screens.

Out of scope: Amazon import fix, image-quality work, the Trailer tool's
(`/trailer`) engine, music. Those stay in the earlier plan.

## Design

### 1. `AdVideoSpec` — the single contract

A new module `lib/services/ads/videoSpec.ts` defines, with a zod schema:

```ts
AdVideoSpec {
  script: {
    hook: string        // ≤ 60 chars, first 2 seconds
    storyLine: string   // ≤ 140 chars, the excerpt/premise beat
    benefits: string[]  // 2–4 items, ≤ 28 chars each
    cta: string         // ≤ 28 chars
  }
  style: {
    preset: TrailerStyle            // starting point; existing 8 presets
    font: AdFontKey                 // one of the curated fonts below
    colors: { bgFrom, bgTo, accent, text }   // #rrggbb
  }
  format: '9:16' | '1:1' | '16:9'
  length: '6s' | '15s' | '20s' | '30s'
  mood: TrailerMusicMood            // unchanged; music is a later task
}
```

Stored on the ads project as a new nullable `Book.videoSpec Json?` column
(one Prisma migration). `defaultVideoSpec(book)` builds a spec from the
existing fields (`customHook`, `ctaText`, `videoStyle`, `videoFormat`,
`videoLength`, `videoMood`, blurb) so existing projects open with sensible,
non-AI text. The character limits are enforced by the schema and shown as
counters in the UI; they are sized so text fits the frame at every format.

### 2. Fonts

Eight curated fonts, bundled as `@fontsource` packages (OFL-licensed, no
network at render time): Inter, Montserrat, Bebas Neue, Playfair Display,
Lora, Cinzel, Merriweather, Caveat. `lib/services/ads/fonts.ts` maps
`AdFontKey → { family, cssImport, weights }`. The composition loads the chosen
font with Remotion's font loading so a frame never renders before the font is
ready; the same files are used by the browser preview and the server render.

### 3. Composition changes (`BookTrailerComposition`)

- Props become `{ spec: AdVideoSpec, coverUrl, interiorImageUrls, title, author }`.
- Palette comes from `spec.style.colors`; `fontFamily` from `spec.style.font`.
  The hard-coded `PALETTES` become the presets that seed those colours.
- Scene text comes from `spec.script`; duration from `spec.length`
  (the preview no longer fixes 10 s).
- Layout fix for the cover beat: title/label block and cover are laid out in
  separate regions per format so they cannot overlap; long text is fitted
  (shrink-to-fit with a floor, then wrap) instead of overflowing.

### 4. Server render (WYSIWYG export)

Remotion's bundler cannot run inside a Next.js app, so:

- `remotion/index.ts` — a `registerRoot` entry exposing one composition,
  `AdVideo`, with `calculateMetadata` deriving width/height/duration from the
  spec.
- `npm run remotion:bundle` — a standalone Node script calling
  `@remotion/bundler` to write a static bundle to `.remotion-bundle/`.
  Runs as part of `build` and on demand in dev; the directory is git-ignored.
- `lib/services/ads/renderVideo.ts` — calls `@remotion/renderer`
  (`selectComposition` + `renderMedia`, codec h264) against
  `.remotion-bundle/`, returns the MP4 buffer plus a poster via `renderStill`.
  `@remotion/renderer` is added to `serverExternalPackages`.
  Headless Chrome is fetched once with `ensureBrowser()`; a clear error is
  returned if it cannot start.
- The ads generate route uses this instead of `trailer/video.ts`. A failed
  video render keeps the images and reports the reason (current behaviour).

Licensing note: Remotion requires a company licence for organisations over
three people; this already applies because `@remotion/player` is in use.

### 5. Instant Video card (results page, light green)

`components/ads/InstantVideoCard.tsx`, light-green surface (new tokens
`--color-instant` / `--color-instant-soft`, with dark-mode values):

- Left: the live player at its real aspect ratio, format toggle (9:16 / 1:1 /
  16:9) and length select.
- Right: "Video text" fields (hook, story line, benefits, CTA) with character
  counters; font picker (each option rendered in its font); colour pickers
  (native `<input type="color">` + hex) and preset chips that reset colours.
- Every edit updates the player immediately (no network).
- "Save & export MP4" PATCHes `videoSpec`, then calls
  `POST /api/ads/projects/[id]/video/instant`, which renders via §4 and
  replaces the set's `videoUrl`/`videoPosterUrl`. Button shows progress;
  the new MP4 is downloadable when done.
- Initial generation (Generate on the configure page) renders the Instant
  Video from `defaultVideoSpec(book)`, so results always open with a video.

### 6. AI Video (cyan button → panel)

A cyan "Generate with AI" button on the results page opens
`components/ads/AiVideoPanel.tsx` (cyan accents, tokens `--color-ai` /
`--color-ai-soft`).

**6a. Editable brief.** `POST /api/ads/projects/[id]/video/ai/brief` builds
an `AiVideoBrief` with `generateStructured`:

```ts
AiVideoBrief {
  shots: {               // 2–3 shots
    prompt: string       // camera, motion, lighting, mood; ≤ 600 chars
    sourceImage: 'cover' | `page-${n}`   // first frame for image-to-video
    durationSec: 4 | 5 | 6 | 8
    caption?: string     // on-screen text burned in afterwards, ≤ 40 chars
  }[]
  endCard: { headline: string; cta: string }  // real cover + text, rendered by us
}
```

System prompt: a book-trailer creative director. Each shot must animate the
given source image (camera move, light, particles, depth), never redraw the
cover or add lettering, and together the shots must build one emotional arc
from the book's premise to the reader's payoff.

The panel shows each shot as an editable card (prompt textarea, image
picker from cover/pages, duration, caption) and the end card fields.
A "Revise with AI" input takes free-text pointers and returns a revised
brief (`mode: 'revise', instruction`) — nothing is saved until the user
saves. The brief is stored on the project as `Book.aiVideoBrief Json?`.

**6b. Cost before spend.** The panel shows the estimated cost from
OpenRouter's model pricing (per video-second × total seconds) next to the
"Generate AI video" button.

**6c. Generation job.** `POST /api/ads/projects/[id]/video/ai` validates the
brief, submits one `POST https://openrouter.ai/api/v1/videos` job per shot
(`model` from `OPENROUTER_VIDEO_MODEL`, `frame_images: [{ frame_type:
'first_frame', image: <source> }]`, `duration`, `aspect_ratio`,
`resolution: '1080p'`, `generate_audio: false`) and stores the job ids and
status on a new `AiVideoJob` row (projectId, status, shots[{jobId, status,
clipUrl}], videoUrl, error, costUsd). It returns immediately.

`GET /api/ads/projects/[id]/video/ai` polls OpenRouter for unfinished shots,
downloads finished clips to storage, and when all are done renders the final
MP4 with a second Remotion composition, `AiAdVideo`: the clips in order with
short cross-dissolves, captions in the spec's font/colours, and the end card
(real cover, headline, CTA). The panel polls every 5 s and shows per-shot
progress; the finished video appears in the panel with Download.

A failed shot marks the job failed with OpenRouter's message; clips that
finished are kept so a retry only regenerates the failed shot.

### 7. Configure and results page layout

- Configure page: the video preview panel and all "Remotion"/"Hyperframes"
  labels are removed; it keeps format, length and mood as plain settings.
- Results page (`CreativeGallery.tsx`): responsive image grid
  (`repeat(auto-fill, minmax(220px, 1fr))`, wide banners span the row, full
  "Download" labels); the video area holds the Instant Video card and the
  cyan "Generate with AI" button / AI Video panel below it.

## Error handling

- AI brief/revise failures leave the user's brief untouched and show a toast.
- No OpenRouter key → the cyan button explains that AI video needs a key in
  Settings; Instant Video keeps working.
- Invalid spec from the client → 400 with the zod message.
- Missing `.remotion-bundle/` → 500 "Video bundle missing — run
  `npm run remotion:bundle`", images still delivered.
- Chrome cannot launch → same path, message names the missing libraries.

## Testing

- `videoSpec.test.ts`: schema limits, `defaultVideoSpec` from legacy fields.
- Brief route test with `generateStructured` mocked: shots reference only
  existing images; revise keeps unedited shots.
- AI video job tests with `fetch` mocked: submit builds the documented request
  per shot; poll handles pending → completed → stitched, and a failed shot
  keeps finished clips.
- Instant export route test: saved spec is passed to the renderer unchanged.
- `renderVideo` smoke test (skipped when Chrome is unavailable): renders a
  2-second spec and checks an MP4 header and duration.
- Playwright at 1440 and 1024 px: results page has no horizontal overflow;
  editing the hook in the green card changes the preview text; the cyan
  button opens the AI panel with editable shot cards.
