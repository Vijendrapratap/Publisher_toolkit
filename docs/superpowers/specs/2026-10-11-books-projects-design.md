# Ads book projects — design (piece A of 4)

Date: 2026-10-11 · Status: approved in conversation

## Why

A walkthrough of the running app showed:

- In Ads, every campaign is its own `Book` row and its own entry in the left rail (21 rows in dev data, six titled "The Lazy Developer"). A+ content, a video and image ads for the same book are scattered across separate entries.
- The book studio's primary-styled "Amazon Ads & A+" button creates a **new** ads row on every click and jumps into the Ads tool without warning (`send-to-ads/route.ts`).
- The home page's "Pick up where you left off" lists only ads rows and always links to `/ads/...`, so written books never appear there.

Goal: in Ads, **a project is a book**. Everything made for that book — A+ images, video ads, image ads — is on one project page; each creation makes only that thing and saves it into the project.

Kept as is (user decision): the home page with its two tools (Create a book · Ads) and the top-bar tool switcher. The tools stay separate so someone who only wants ad images never deals with book writing.

Pieces, built in order:

- **A — Ads book projects** (this spec)
- B — Book editor: edit page text, Ask AI per page, redraw one picture, add/reorder pages, continue the story
- C — New book start: type → idea *or* "I've written some of it" → age + style → create
- D — Create flows for A+ / video / image ads, replacing today's configure page

Until D ships, a project's "Create" buttons hand off to the existing configure → generate → results pages.

## Model

- **Project = root `Book` row** (`parentBookId IS NULL`).
- **Creations = child `Book` rows** (`parentBookId = root.id`), one per creation, holding its settings and `contentGoal` (`sponsored` · `aplus` · `video`) — the existing campaign mechanism. Outputs are the existing `CreativeSet` (+ images, copy, `videoUrl`) and `AiVideoJob` rows. The UI never says "campaign".
- **Written books** link to their Ads project through a new column `Book.creatorProjectId String? @unique` on the root. The root is created lazily, the first time the user clicks *Promote this book*. No backfill.

### Keeping a written book's project current

`syncProjectFromCreator(creatorProject, publisherId)` (new, `lib/services/ads/projects.ts`) upserts the root by `creatorProjectId`: `title`, `author`, `blurb = promptConcept`, `frontCoverUrl = coverImageUrl`, `interiorImageUrls` (first five illustrated pages — the mapping now in `send-to-ads`). Called by the promote route, and by `POST /api/ads/projects` when `existingBookId` is a root with a `creatorProjectId` (before the child copies the root's fields), so creations always use the latest cover and pages.

## Screens

### Home (`/`) — unchanged except

"Pick up where you left off" mixes recent ads projects (roots) and written books, newest first, four cards. Each card's label and link match its tool: *Ads* → `/ads/books/[rootId]`, *Book* → `/create-book/[id]`.

### `/ads` — Your books

- Replaces the "How it works" page and the left `ProjectRail` (removed from the ads layout).
- Heading "Your books", primary **Add a book** → `/ads/new`.
- Grid of project cards: cover, title, author, and what exists — e.g. "A+ images · Video" or "Nothing made yet". Sorted by latest activity across the root and its children.
- Empty state: one sentence + Add a book.

### `/ads/new` — Add a book

Replaces today's long form with one job: identify the book.

- If the library has books: their covers first ("Pick one of your books") — choosing one goes straight to its project page.
- **Add a new book**: paste an Amazon / Goodreads link → *Get details* (existing `/api/extract-url`); or *upload a cover instead* (cover, title, author, optional inside pages); "Have a PDF?" link for the PDF path.
- Submit: existing `POST /api/ads/projects` payloads without campaign settings → `/ads/books/[newRootId]` (or the existing `/ads/[id]/upload` when `needsManualCover`).

### `/ads/books/[id]` — Project page

```
← Your books
[cover]  <Title>
         <Author>                              Edit details
──────────────────────────────────────────────────────────
What do you want to make?
  A+ images for Amazon   [thumb][thumb][thumb]  2 days ago   [View] [Create new]
  Video ad               [poster] 0:15                       [View] [Create new]
  Ad images              Not made yet · 3 credits                   [Create]
```

- Rows in this order: A+ images (`aplus`), Video ad (`video`), Ad images (`sponsored`). Each shows the **latest** finished version: up to three image thumbnails, or the video poster + duration, plus "N earlier versions" when there are more (each linking to its results).
  - *View* → `/ads/[childId]/results`.
  - *Create* / *Create new* → `POST /api/ads/projects { existingBookId: root.id, contentGoal }` → `/ads/[newChildId]/configure` (replaced by piece D).
  - Newest child for a row has no output yet: "Not finished — *Continue*" → `/ads/[childId]` (existing resume redirect), instead of creating another.
  - Legacy rows with `contentGoal` `all`/NULL — including a root that was itself a campaign — are sorted by content: A+ sizes → A+, sponsored sizes → Ad images, `videoUrl` or a completed `AiVideoJob` → Video. One legacy set may appear in more than one row.
- If `creatorProjectId` is set: a small "Written in Create a book — *Open book*" link.
- **Edit details**: inline title / author form (existing `PATCH /api/ads/projects/[id]` on the root).

### Book studio (`BookProjectStudio`)

- Remove the primary "Amazon Ads & A+" button.
- Add a secondary **Promote this book** link → `POST /api/creator/projects/[id]/promote` → `{ projectUrl }` → navigate. The route finds the root by `creatorProjectId`, creating it on first use, and syncs it. Repeated clicks open the same project.
- Replaces `send-to-ads/route.ts` (deleted with its tests).

### `/ads/[id]/*` (existing creation pages)

Header gains "← <book title>" to `/ads/books/<rootId>`; "Another campaign" is removed. Otherwise unchanged until piece D.

## Code

- Migration: `Book.creatorProjectId String? @unique`.
- `lib/services/ads/projects.ts` (new): `getAdsProjects(publisherId)`, `getAdsProject(publisherId, rootId)` (root + children + latest `CreativeSet` per child + latest `AiVideoJob` per child), `syncProjectFromCreator(...)`.
- `lib/services/ads/projectAssets.ts` (new, pure): `groupProjectAssets(rows)` → `{ aplus, video, sponsored }`, each `{ latest, earlier, draft }`, with the legacy rules; `summarizeProject(groups)` for the card line.
- Pages: `app/(platform)/ads/page.tsx` (rewritten), `app/(platform)/ads/new/page.tsx` + `components/ads/AddBookForm.tsx` (replaces `NewProjectForm.tsx`), `app/(platform)/ads/books/[id]/page.tsx`, `app/(platform)/ads/layout.tsx` (rail removed), `app/(platform)/page.tsx` (recent work).
- Route: `app/api/creator/projects/[id]/promote/route.ts` (new); `send-to-ads` deleted.

## Testing

- Unit: `projectAssets.test.ts` (row grouping incl. legacy `all` sets, drafts, latest-wins, earlier versions), `projects.test.ts` for `syncProjectFromCreator` field mapping and interior-image cap.
- Route: `promote` creates the root once and reuses it on the second call; `POST /api/ads/projects` with a written-book root syncs before copying.
- E2E: update `e2e/ads.spec.ts` — `/ads` shows book cards; add a book by upload → project page; *Create* in the A+ row lands on configure; a finished creation shows under its row. Home recent work links a written book to `/create-book/...`.
- `tsc --noEmit`, `npm test`, `npm run test:e2e` pass before reporting done.
