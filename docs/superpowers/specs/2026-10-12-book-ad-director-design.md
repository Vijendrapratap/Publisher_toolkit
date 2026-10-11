# Book ad director: video ads that look like the good ones

## Why

Today's video ads look basic. The Instant video is a fixed 4-card template: three cards
are text on a gradient, the cover shows once, at most 2 inside pages appear small and
still, no AI writes the script (benefits are always empty, copy is filler such as
"OFFICIAL BOOK TRAILER"), and motion barely registers. The AI Video brief is written by a
text-only model that never sees the cover or pages it animates.

## What good looks like (studied from 4 reference ads)

| Ad | Approach |
|---|---|
| Can You Find the Halloween Thief? (~20s) | Real 3D cover in an AI Halloween-cinema setting, glowing "?" smoke, short serif lines on the left, falling leaves, ends where it began |
| The Killer Left His Coat on the Hook (~26s) | Film-like AI footage, small cover pinned in a corner, story told on dark title cards |
| Murder at Thornwick Mill (~20s) | Book on a library desk opens to real inside pages; zooms with caption bars ("120 CASES. ONE PER PAGE."); end card with series line |
| Jumbo Autumn Word Search (~23s) | Soft background in the cover's colours, cover slides side to side with two-line benefits, book opens and pans real pages, "A THOUGHTFUL AUTUMN GIFT FOR SENIORS" |

Rules they share, which this design encodes:

1. The **real cover** is the sharp hero. It is never redrawn by AI.
2. **Real inside pages** are shown, zoomed and panned.
3. **One short idea per beat**: at most 7 words a line, 2 lines, held 2–4 s.
4. Order: **hook → concrete numbers → who it's for → title**.
5. **Constant gentle motion**: push-ins, pans, particles. No still frames.
6. A **themed setting** for the genre, or a soft background in the cover's colours.
7. **Reads with the sound off.** 15–30 s.
8. **Loops**: the last frame leads back to the first.

## Decisions (agreed)

- Scope: both looks. **Phase 1** is the product look (cover, pages, AI setting, beats).
  **Phase 2** adds cinematic AI footage on the same engine.
- One engine: a new Remotion composition `BookAd` replaces the 4-card Instant template.
  In phase 2 the AI Video path feeds clips into it, replacing the separate ffmpeg stitch.
  The Trailer service keeps its own engine for now.
- Remotion's official agent skill (`remotion-best-practices`) is installed in
  `.claude/skills` and guides the build: scenes as components in `TransitionSeries`,
  frame-driven `interpolate`/`spring` only, `premountFor={fps}` on timed items.

## Phase 1

### Storyboard (the data)

Stored in `Book.videoSpec` as a new optional `storyboard` field, so no migration is
needed. A spec without one gets the fixed storyboard (below), so `BookAd` always renders.

```ts
storyboard: {
  theme: {
    settingPrompt: string          // what the image model draws; no text, no book
    settingImageUrl: string | null // drawn once, reused on re-export
    palette: { bg, ink, accent }   // taken from the cover by the director
    font: AdFontKey                // display font for beats
    particles: 'leaves' | 'snow' | 'dust' | 'embers' | 'none'
    cornerCover: boolean           // small cover pinned top-left on dark beats
  }
  beats: Beat[]                    // 2–9 beats; the director aims for 5–9, a bare book may get fewer
}

Beat =
  | { kind: 'hook';      text; image: 'cover'; side: 'left' | 'right'; seconds }
  | { kind: 'titleCard'; text; seconds }
  | { kind: 'pageZoom';  text; page: number; focus: { x, y, zoom }; seconds }
  | { kind: 'bookOpen';  text?; pages: [number, number]; seconds }
  | { kind: 'proof';     text; image: 'cover' | page number; seconds }
  | { kind: 'audience';  text; seconds }
  | { kind: 'endCard';   title; subtitle?; cta; seconds }
```

Limits checked in code:
- `text` is at most 2 lines of at most 7 words, 60 characters in total.
- `seconds` is 2–4 per beat, and the end card is 3–4.
- The first beat is `hook` or `titleCard`; the last is `endCard`.
- `page` must exist.
- The total must match the chosen length (15, 20 or 30 s), allowing for transitions; the
  code rescales beat seconds if the model is off.

### The director (rewritten prompt and a vision model)

- New env `OPENROUTER_VISION_MODEL`, default `google/gemini-3.8-flash`. It is called
  through the existing `generateStructured` with image parts.
- **Input:**
  - the cover and up to 6 inside pages, downscaled to 768 px
  - title, author, blurb, bullets, categories, page count
  - format, length, mood and style from the Configure page
  - an optional direction from the publisher
- **Output:** the storyboard (schema above).
- The **system prompt** states the 8 rules, the beat types and when to use each:
  - Puzzle, activity and colouring books lead with what is inside (`bookOpen`/`pageZoom`
    with counts).
  - Stories lead with a tension line (`hook`/`titleCard`).
  - Children's books lead with warmth and the age range.

  It also says:
  - **Use only numbers and claims found in the details or visible on the pages.**
  - Pick zoom focus points on the part of a page that proves the line shown.
  - Describe the setting as a place with empty space where a book could sit. No text,
    no book, no people's faces.
  - Take the palette from the cover.
- **Revision:** the same call with the current storyboard and the publisher's
  instruction; anything not asked for stays.
- **Fixed storyboard** (used when the AI fails or nothing has been directed yet):
  1. hook (title)
  2. bookOpen, when there are 2 or more pages
  3. pageZoom for each further page, up to 2
  4. audience (from the bullets, if any)
  5. endCard

  The palette comes from the current style preset, and there is no setting picture.

### Setting picture

- Drawn by the image model from `theme.settingPrompt` at the video's shape.
- Stored under `ads/{publisherId}/settings/` and saved in `theme.settingImageUrl`.
- Drawn only when the director writes a new storyboard, not on re-export.
- If drawing fails, a soft gradient in the theme palette is used instead.
- Recommended env change: `OPENROUTER_IMAGE_MODEL=google/gemini-3.1-flash-image`.

### Composition `BookAd`

- **Location:** `components/ads/remotion/` (`BookAd.tsx` plus one file per beat
  scene).
- **Registration:** in `remotion/Root.tsx` alongside the existing ones, at 30 fps.
- **Size:** 1920×1080, 1080×1080 or 1080×1920 by format.
- **Duration:** the sum of the beats minus the transition overlaps.
- **Scenes:** each beat is a scene in `TransitionSeries`. Transitions come from
  `@remotion/transitions` (fade, slide, wipe), pinned at 4.0.525, chosen by beat pair.
  A soft light-leak plays on the hook.
- **Shared layers:**
  - the setting picture (or palette gradient) with a slow push-in across the whole video
  - particles by theme
  - vignette and film grain
  - corner cover on `titleCard` beats when `cornerCover` is on
  - music from the existing library, with fades
- **`Book3D`:**
  - The real cover is the front face, with a spine coloured from the cover's left edge,
    a page-block edge and a contact shadow.
  - It turns slowly (±8°) and floats.
  - It can **open**: the front cover rotates away on its spine to show two real pages
    side by side.
- **Text:**
  - Each line enters as a word-group fade and rise and leaves with a fade.
  - It is always placed on the side away from the book.
  - Lines are sized to fit with the existing `fitFontSize`.
  - Fonts come from `@remotion/google-fonts`.
- **`pageZoom`:** the page fills the frame and pans from a wide view to `focus` over the
  beat, with a caption bar at the bottom in the theme colours.
- **`endCard`:** the 3D cover, title, optional series line and an accent CTA button. The
  final frames match the first beat's background, so the video loops.
- **Layout:** works for all three shapes. In 9:16 the book sits above the text; in 16:9
  and 1:1 they sit side by side.

### Rendering and storage

- The instant route renders `BookAd` with the storyboard, inlined images (the cover, the
  pages the storyboard uses, and the setting) and music.
- Output, poster and price (2 credits) are unchanged.
- `adVideoImages` stops capping pages at 2. It inlines only the pages the beats use, up
  to 6.

### Editing in the app

- The video card on the results page gets **Direct my ad** (runs the director), plus
  **Change it** with a direction box.
- A beat list lets you edit each beat's text and seconds, change which page it shows,
  reorder beats and remove them.
- The live preview is `@remotion/player` on `BookAd`, the same composition as the export.
- The old hook/story/benefits fields go. The music, font and colour controls stay and map
  to the theme.
- Directing costs nothing extra up front; the 2 credits are charged on export as today.
  Directing is rate-limited like the AI brief (30 per hour).

### Testing

- Unit tests:
  - storyboard schema and limits
  - rescaling to the chosen length
  - the fixed storyboard
  - the director prompt includes the images and facts, and falls back when the model
    fails
  - beat/page validation
  - total-frame maths with transition overlaps
- Route tests: Direct my ad, and the instant export using `BookAd`.
- A **sample render script** (`scripts/render-sample-ad.mjs`) renders real ads for two
  books from the dev database (a word-search book and a story book). Their frames are
  compared with the references in the same timestamped contact-sheet form used to study
  them.
- The existing e2e flows still pass. The instant-video e2e checks that editing a beat's
  text shows in the preview.

## Phase 2 (cinematic, separate plan)

- The director may add `clip` beats. A video model (default
  `OPENROUTER_VIDEO_MODEL=bytedance/seedance-2.0`; Veo 3.1 Fast also suits) animates the
  setting picture, or a second setting, into 2–3 clips of 4–6 s.
- `hook` and `titleCard` beats can play over a clip instead of the still setting.
- The AI Video panel becomes a "Cinematic" switch on the same card. Clips are rendered
  inside `BookAd`, replacing `aiVideoStitch`. Pricing stays as today's AI video units.

## Out of scope

- The Trailer service (canvas engine) moves to `BookAd` later.
- Voice-over and sound effects.
- New music.
