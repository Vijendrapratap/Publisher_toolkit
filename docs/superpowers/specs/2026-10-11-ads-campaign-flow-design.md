# Ads campaign flow — design

Date: 2026-10-11 · Status: approved in conversation, pending spec review

## Why

Publishers found the Ads tool confusing. A walkthrough of the running app showed:

1. Campaign name, objective and colour palette are asked on `/ads/new` and asked again on `/ads/[id]/configure`.
2. Configure shows a "platform" card with a single, permanently selected option (Amazon) — a choice that isn't one.
3. `/ads/new` opens on four source tabs (Link · Upload · Library · PDF) before the user has said what they want to make, and defaults to *Link* even when the library has books.
4. Video results stack two editors (*Instant Video* and *AI Video*) with no guidance on which to use.
5. Results repeats itself: three headings saying "Amazon A+ Content", two zip download buttons, and an over-limit copy warning shown only as an orange counter.
6. There is no path from a finished campaign to the next thing for the same book.
7. The left project rail lists every campaign row (21 in dev data); campaigns of the same book are indistinguishable.

Success: a first-time publisher can go from `/ads` to finished image ads, A+ content or a video without reading instructions, answering one question at a time, never seeing the same question twice.

Out of scope (separate passes, in this order): the Create-a-book flow, then the home page and top navigation. The other services (trailer, landing, audiobook) are untouched.

## The flow

`/ads` (Your campaigns) → `/ads/new` (5 questions on one progressive page) → `/ads/[id]/generate` (existing progress screen) → `/ads/[id]/results`.

The separate Configure step disappears from the new-campaign path. `/ads/[id]/configure` remains as the "Edit settings" page and renders the same builder.

### `/ads` — Your campaigns

- Header: "Your campaigns" + primary **New campaign** button.
- Filter chips: All · Image ads · A+ content · Video (client-side filter on `contentGoal`; legacy `all`/null rows show under All only).
- Grid of cards: cover, book title, `<what> · <goal>` (e.g. "Image ads · Launch"), status (`Ready` / `Draft · Continue`), relative time. Card links to `/ads/[id]` (existing resume redirect).
- Empty state: one sentence + New campaign button.
- Removed: the left `ProjectRail` on all ads pages and the "How it works" box.

### `/ads/new` — Campaign builder

One page. Answered questions collapse to a single summary row with a **Change** link; only the current question is open; later questions show as muted titles. Continue moves to the next question; Change re-opens that question (later answers are kept unless they no longer apply).

| # | Question | Content | Notes |
|---|---|---|---|
| 1 | **What do you want to make?** | Three cards: Image ads · A+ content · Video, each with its credit price (`goalCreditLabel`). | Pre-answered by `?make=sponsored\|aplus\|video`. |
| 2 | **Which book?** | Library covers (from `getPublisherBookLibrary`) + an **Add a new book** tile. Add opens: paste a store link → *Pull details* (existing `/api/extract-url`), with "or upload a cover instead" (cover, title, author, blurb) and a small "Have a PDF?" link (PDF + optional cover). For A+ and Video only: "Add 2–5 inside pages (optional)". | Pre-answered by `?book=<id>`. With an empty library, the Add form is shown directly. Summary row shows cover + title + author (PDF: file name). |
| 3 | **What's this campaign for?** | Four objectives shown: launch, preorder, discount, evergreen. *More goals* reveals review_quote, tropes, custom (existing `CustomCampaignPicker`). | Campaign name auto-set to `<title> · <objective short label>`. |
| 4 | **Pick a look** | Image ads / A+: four suggested palettes, *See all styles* (all `TEMPLATES`), *Custom* (existing `CustomPalettePicker`). Video: shape (16:9 Amazon / 9:16 Reels), length, video style. | Video mood moves to More options. |
| 5 | **Review & create** | One sentence summary, e.g. "4 image ads for *Mastering RAG* — launch campaign, Classic look." Collapsed **More options**: copy tone, target audience, custom hook, CTA text, campaign name (and video mood for Video), all pre-filled. Button: **Create image ads · 3 credits** (label and price follow the goal). | |

Nothing is persisted until the final button. On submit: `POST /api/ads/projects` (existing payloads: `existingBookId` JSON, store-link JSON, or multipart for uploads/PDF) → `PATCH /api/ads/projects/[id]` with the remaining settings (`platforms: ['AMAZON']` sent implicitly so the row becomes `configured`) → navigate to `/generate`. If the POST returns `needsManualCover`, navigate to the existing `/upload` page instead.

Errors stay inline at the question they belong to (step 2 for link/upload failures, step 5 for create failures).

### `/ads/[id]/configure` — Edit settings

Same builder in edit mode: questions 1–2 shown as locked summary rows (no Change — `contentGoal` isn't updatable and a different book is a different campaign); questions 3–5 shown collapsed with their saved answers, each with Change. Final button: **Save & regenerate · N credits**. A `?error=` from a failed generation shows the existing "Generation didn't finish" banner above the builder.

### Campaign header (all `/ads/[id]/*` pages)

Breadcrumb "Ads / <title>", cover, title, `<what> · <goal>`, status badge. The Upload/Configure/Generate/Results `Stepper` and the "Another campaign" button are removed from ads.

### `/ads/[id]/results`

- One heading row: `<title> · <what>` with **Download all (.zip)** as the single primary action and *Edit settings* as a ghost link.
- Images: existing `CreativeGallery`.
- Ad text: existing `CopyEditor`, with over-limit fields explained in words: "Amazon shows up to 150 characters — shorten by 39."
- **Where to upload** — collapsed `<details>` holding the KDP A+ Manager / Amazon Ads console links and the three how-to steps now in `AmazonPackagePanel`. "Copy ad text" stays inside the copy editor area.
- Video goal: `InstantVideoCard` is the main result. `AiVideoPanel` sits below as one collapsed card: "Want a more cinematic version? AI video · 10 credits per 5s" — expanded on click, or automatically when a job already exists.
- **Next for this book**: buttons for the goals this book doesn't have a ready campaign for yet (e.g. "Make A+ content", "Make a video"), linking to `/ads/new?book=<rootId>&make=<goal>`.
- Removed: the duplicate "Amazon Ads & A+ Content" platform card heading, `AmazonPackagePanel`'s second zip button and "Package contents" list.

## Components

- **`components/ads/CampaignBuilder.tsx`** (new, client) — the progressive page. Owns answers state; renders one `BuilderStep` per question. Props: `mode: 'new' | 'edit'`, `library`, `initial` answers, `projectId?`.
- **`lib/services/ads/builder.ts`** (new, pure) — `currentStep(answers, openStep)`, `isStepAnswered(step, answers)`, `buildCampaignName(title, objective)`, `summaryLine(answers)`, `submitLabel(goal)`. Unit-tested.
- Reused unchanged: `Dropzone`, `InteriorImagesDropzone`, `CustomPalettePicker`, `CustomCampaignPicker`, `CreativeGallery`, `CopyEditor`, `InstantVideoCard`, `AiVideoPanel`, `GenerateRunner`, all API routes.
- Deleted once replaced: `components/ads/NewProjectForm.tsx`, `components/ads/ConfigureForm.tsx`, `components/ads/AmazonPackagePanel.tsx` (its links/how-to move into the results page), the rail in `app/(platform)/ads/layout.tsx`. `ProjectRail`/`RailLink`/`Stepper` stay while trailer/landing/audiobook still use them.

No schema or API changes.

## Testing

- Unit (vitest): `lib/services/ads/builder.test.ts` — step progression, pre-answered query params, edit-mode locking, campaign name, submit label/price per goal.
- E2E (playwright): rewrite `e2e/ads.spec.ts` for the new path — library book → Image ads → goal → look → create → results shows images and Download all; plus `?book=&make=` deep link opens at question 3. Keep the existing designed-states test. Update `e2e/ads-instant-video.spec.ts` and `e2e/ads-ai-video.spec.ts` where they reach results through the old flow or expect the AI video panel open.
- `tsc --noEmit`, `npm test`, `npm run test:e2e` must pass before reporting done.
