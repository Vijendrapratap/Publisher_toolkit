# Ads Creative: editable video script, fonts & colours, WYSIWYG export

Date: 2026-09-23 · Status: awaiting review

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
3. **No text editing before render.** The video's hook/lines/CTA are not
   editable anywhere; banner copy is editable only after generation.
4. **AI is the final submit.** "Generate" always calls the AI for copy.
5. **Fonts and colours are hard-coded** (system serif/sans, 8 fixed palettes).

## Goals

- Everything the video says, and how it looks, is editable before rendering,
  with an instant live preview.
- AI is an optional helper that fills or improves fields on request. Generate
  renders exactly what is in the editor and makes no AI call for video text.
- The downloaded MP4 is a pixel match of the preview.
- The configure and results pages lay out cleanly from 1024 px up and stack on
  narrow screens.

Out of scope: Amazon import fix, image-quality work, AI image-to-video clips,
the Trailer tool's (`/trailer`) engine. Those stay in the earlier plan.

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

### 5. AI as an optional helper

New route `POST /api/ads/projects/[id]/video-script/ai` with body
`{ mode: 'fill' | 'improve', field?: 'hook'|'storyLine'|'benefits'|'cta', instruction?: string }`:

- `fill` writes any empty fields from the book details.
- `improve` rewrites one field (or the whole script) following the optional
  instruction ("make the hook punchier").
- Returns a proposed script; the UI shows it in the fields and nothing is
  saved until the user saves. Uses `generateStructured` with the existing
  muted-autoplay copy rules from `lib/services/videoad/copy.ts`.

Banner copy follows the same rule: a copy editor on the configure page with
an optional "✨ Write with AI" button. On Generate, saved copy is used as-is;
empty copy falls back to the existing non-AI template (`ads/sampleCopy.ts`),
never to a silent AI call.

### 6. Configure page UI (`components/ads/ConfigureForm.tsx`)

- ≥ 1024 px: two columns — settings (left, scrolls) and a sticky preview
  column (right, ~420 px) containing the player, a format toggle and scene
  chips on their own rows.
- New "Video Script & Style" card: four script fields with counters and a
  per-field "✨ Improve" (opens a one-line instruction input), a "✨ Write with
  AI" button for the whole script, a font picker (each option rendered in its
  font), colour pickers (native `<input type="color">` + hex field) and
  preset chips that reset the colours.
- Edits update the preview immediately; saved via the existing PATCH route
  (extended to accept `videoSpec`).
- The final button reads "Generate creatives & video" and never calls AI for
  the video text.

### 7. Results page UI (`components/ads/CreativeGallery.tsx`)

- Responsive grid: `repeat(auto-fill, minmax(220px, 1fr))`; cards keep the
  full "Download" label; wide banners span the row.
- Video card: full-width header, player at its real aspect ratio, and an
  "Edit script & style" link back to the configure page.

## Error handling

- AI helper failures leave the user's text untouched and show a toast.
- Invalid spec from the client → 400 with the zod message.
- Missing `.remotion-bundle/` → 500 "Video bundle missing — run
  `npm run remotion:bundle`", images still delivered.
- Chrome cannot launch → same path, message names the missing libraries.

## Testing

- `videoSpec.test.ts`: schema limits, `defaultVideoSpec` from legacy fields.
- AI route test with `generateStructured` mocked: fill only touches empty
  fields; improve returns only the requested field.
- Generate route test: saved spec and copy are passed through unchanged, no
  AI call when copy is present; renderer mocked.
- `renderVideo` smoke test (skipped when Chrome is unavailable): renders a
  2-second spec and checks an MP4 header and duration.
- Playwright: configure page at 1440 and 1024 px — no horizontal overflow in
  the preview column; editing the hook updates the preview text.
