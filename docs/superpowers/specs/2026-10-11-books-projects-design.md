# Books as projects — design (piece A of 4)

Date: 2026-10-11 · Status: approved in conversation, pending spec review

## Why

The platform is organised by tool (Create a book · Ads), and each tool keeps its own list. A walkthrough of the running app showed what that costs users:

- One book exists as unrelated rows: a written book in `BookCreatorProject`, and one `Book` row **per ads campaign** (21 rows in dev data, six titled "The Lazy Developer").
- The book page's primary-styled "Amazon Ads & A+" button silently creates a new ads row on every click and jumps into the Ads tool (`send-to-ads/route.ts`).
- The home page's "Pick up where you left off" lists only ads rows and always links to `/ads/...`, so continuing a written book from home lands in ads.

Goal: **a project is a book.** Everything made for a book — its pages (if written here), A+ content, video ads, image ads — lives on one project page. Each creation makes only that thing and saves it into the project. Plain language throughout, because the audience includes everyday people making a book for themselves, not just publishers.

This is piece A of four, built in order:

- **A — My books + project page** (this spec)
- B — Book editor: edit page text, Ask AI per page, redraw one picture, add/reorder pages, continue the story
- C — New book start: type → idea *or* "I've written some of it" → age + style → create
- D — Create flows for A+ / video / image ads, each saved into the project

Until D ships, A's "Create" buttons hand off to the existing ads configure → generate → results pages. Until B ships, "Open book" opens the existing book studio.

## Model

- **Project = the root `Book` row** (`parentBookId IS NULL`).
- **Creations = child `Book` rows** (`parentBookId = root.id`), each holding one creation's settings and `contentGoal` (`sponsored` · `aplus` · `video`), exactly as campaigns work today. Its outputs are the existing `CreativeSet` (+ images, copy, `videoUrl`) and `AiVideoJob` rows. Users never see the word "campaign".
- **Written books** link to their project through a new column `Book.creatorProjectId String? @unique` on the root row.

### Migration

1. Add `creatorProjectId` (nullable, unique) to `Book`.
2. Backfill: for every `BookCreatorProject` with no linked root, insert a root `Book` with `publisherId`, `title`, `author`, `blurb = promptConcept`, `frontCoverUrl = coverImageUrl`, `creatorProjectId = id`, `contentGoal = NULL`, `status = 'uploaded'`.

No data is deleted. Existing `send-to-ads` rows stay as independent projects (they can't be linked reliably).

### Keeping the root in sync with a written book

`syncProjectFromCreator(creatorProject)` (new, `lib/services/books/sync.ts`) upserts the root row's `title`, `author`, `blurb`, `frontCoverUrl` and `interiorImageUrls` (first five illustrated pages — the mapping now in `send-to-ads`). Called:

- in `POST /api/creator/projects`, after the creator row is created (creates the root);
- in `POST /api/ads/projects` when `existingBookId` points at a root with a `creatorProjectId`, before the child copies the root's fields — so a creation always uses the latest cover and pages.

## Screens

### Top bar

Logo + "My books" link → `/`. Credits and account chip unchanged. The tool switcher (`ServiceSwitcher`) is removed from the top bar.

### `/` — My books (replaces the tool hub)

- Heading "My books", primary **New book** button, then a grid of book cards plus a dashed **New book** tile.
- Card: cover (written book's cover preferred), title, author, and a one-line count of what exists — e.g. "Picture book · A+ content · Video" or "Nothing made yet".
- Sorted by most recent activity (latest `updatedAt` across root and children).
- Empty state: "Make your first book" with the two New book choices inline.

### `/books/new` — New book

One question, two large choices:

- **Write a new book with AI** → `/create-book/new` (replaced by piece C).
- **Add a book I already have** → inline form: paste an Amazon / Goodreads link → *Get details* (existing `/api/extract-url`); or *upload a cover instead* (cover, title, author). Submit uses the existing `POST /api/ads/projects` payloads with no `contentGoal` → lands on `/books/[id]`.

### `/books/[id]` — Project page

```
← My books
[cover]  <Title>
         <Author> · <Picture book | Your book>          Edit details
──────────────────────────────────────────────────────────
YOUR BOOK                               (only if creatorProjectId)
  12 pages · 4 of 12 pictures drawn
  [Open book]  [Draw the rest · 24 credits]  [Download PDF]

SHARE & SELL YOUR BOOK
  A+ images for Amazon   [thumb][thumb][thumb]  2 days ago   [View] [Create new]
  Video ad               [poster] 0:15                       [View] [Create new]
  Ad images              Not made yet · 3 credits                   [Create]
```

- **Your book**: only one primary button — *Draw the rest* while pictures are missing (same price logic as today's studio), otherwise *Download PDF*. *Open book* → `/create-book/[creatorProjectId]`.
- **Share & sell** rows, in this order: A+ images (`aplus`), Video ad (`video`), Ad images (`sponsored`). Each shows the **latest** finished version: up to three image thumbnails, or the video poster + duration.
  - *View* → `/ads/[childId]/results`.
  - *Create* / *Create new* → `POST /api/ads/projects { existingBookId: root.id, contentGoal }` → `/ads/[newChildId]/configure` (replaced by piece D).
  - If the newest child for that row has no output yet: "Not finished — *Continue*" → `/ads/[childId]` (existing resume redirect).
  - Legacy rows with `contentGoal` `all`/NULL (including the root itself when it was a campaign) are sorted by what they contain: A+ sizes → A+, sponsored sizes → Ad images, `videoUrl` or a completed `AiVideoJob` → Video. One legacy set can appear in more than one row.
- **Edit details**: inline form for title / author (PATCH existing routes; for written books it PATCHes the creator project and re-syncs).

### Changes to existing pages

- `/create-book` and `/ads` redirect to `/`.
- Book studio (`BookProjectStudio`): remove the "Amazon Ads & A+" button and its handler; back link becomes "← <title>" to `/books/<rootId>`.
- `/ads/[id]/*` header: add a "← <book title>" link to `/books/<rootId>`; remove "Another campaign". The ads `ProjectRail` (layout) is removed. Configure / generate / results pages are otherwise unchanged until piece D.
- Delete `app/api/creator/projects/[id]/send-to-ads/route.ts` and its test cases.

## Code

- `lib/services/books/queries.ts` (new): `getMyBooks(publisherId)` and `getProject(publisherId, rootId)` — root + children + latest `CreativeSet` per child + latest `AiVideoJob` per child + linked creator project.
- `lib/services/books/assets.ts` (new, pure): `groupProjectAssets(rows)` → `{ aplus, video, sponsored }`, each `{ latest, versions, draft }`, including the legacy sorting rules. `summarizeBook(...)` for the My books card line.
- `lib/services/books/sync.ts` (new): `syncProjectFromCreator`.
- Pages: `app/(platform)/page.tsx` (rewritten), `app/(platform)/books/new/page.tsx`, `app/(platform)/books/[id]/page.tsx`.
- Removed: `components/platform/ServiceCard.tsx`, `ServiceSwitcher.tsx` (if no other user), ads `ProjectRail` usage, `send-to-ads` route.

## Testing

- Unit: `assets.test.ts` (grouping incl. legacy `all` sets, drafts, latest-wins), `sync.test.ts` (field mapping, interior image cap).
- Route: `POST /api/creator/projects` creates the linked root; `POST /api/ads/projects` with a written-book root syncs before copying.
- E2E: new `e2e/books.spec.ts` — home shows My books; open a project; *Create* in A+ row lands on configure; `/ads` and `/create-book` redirect home. Update `e2e/ads.spec.ts` for the removed rail/hub.
- `tsc --noEmit`, `npm test`, `npm run test:e2e` pass before reporting done.
