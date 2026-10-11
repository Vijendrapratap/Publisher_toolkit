# Ads Creative: start from what you want to make

Supersedes the "book page as the way in" parts of `2026-10-11-books-projects-design.md`.
The data model from that spec stays: a book is a root `Book` row, and each thing made
for it is a child row with `contentGoal` = `sponsored` | `aplus` | `video`.

## What the user asked for

- Ads Creative should not be book-centric. People come to make **ad images, A+ content
  or a video ad** for their book. Organise around those outputs.
- Everything made is saved, and easy to find again by type, without the screen getting
  complex.
- Home stays as it is (Create a book and Ads Creative stay separate tools).

## Success

A person who has never used the app can, from `/ads`, make A+ content for a book in
three screens (pick type → pick book → choose a few settings → generate), and later find
it under "A+ content" in Your creations.

## Screens

### 1. `/ads` — Ads Creative home

- Heading "What do you want to make?" and three cards: **Ad images**, **A+ content**,
  **Video ad**, each with a one-line description and its credit price
  (`goalCreditLabel`). Each links to `/ads/make/<kind>`.
- **Your creations** below it: one card per thing made, newest first. A card shows a
  thumbnail (first image or video poster), the type, the book title and how long ago.
  It opens `/ads/<rowId>/results`. A creation that was started but never generated
  shows an "Unfinished" tag and opens `/ads/<rowId>` (which resumes at the right step).
- Filters are links that set search params, so no client state is needed:
  - type tabs: All · Ad images · A+ content · Videos (`?type=`)
  - a book filter (`?book=<rootId>`), shown only when the person has more than one book.
    When a book is chosen, the three make cards become "Make … for *Title*" and start
    straight away for that book (skipping the picker).
- Empty state (nothing made yet): the three cards alone, with "Your creations will
  appear here" under them.

### 2. `/ads/make/<kind>` — Which book?

- Title "Ad images — which book?" (or A+ / Video), with a back link to Ads Creative.
- A grid of the person's books (cover and title). Clicking one starts the creation for
  that book and goes to its settings (`/ads/<id>/configure`).
- An "Add a new book" tile that opens the existing `AddBookForm` (store link, cover
  upload, PDF) in place. When the book is added, the creation starts for it at once.
  - PDF whose cover could not be read: go to `/ads/<root>/upload?make=<kind>`; that
    page's Continue returns to `/ads/make/<kind>`, where the new book is first.
- No books yet: the add form is shown open.
- An unknown kind returns 404.

### 3. `/ads/<id>/configure` — choices on the left, live preview on the right

Two columns on desktop; on phones the preview comes first
and Generate is a bar pinned to the bottom.

- **Live preview:** for image ads and A+, the real `CreativeTemplate` scaled down, with a
  chip per size you'll get. For video, a frame in the chosen shape and motion-style colours,
  with "30 seconds · Suspenseful · Classic Film" under it. Under both: the sample ad
  text for the chosen tone, what you'll get, and Generate with its price.
- **Chips, not cards or dropdowns.** Shown per type:

| Type | Shown | Under More options |
|---|---|---|
| Ad images / A+ | Style (+ Your colours), Badge on the ad (+ Write your own), Button text (+ Write your own), Writing tone | Headline hook, who it's for, name |
| Video ad | Shape, Length, Mood, Motion style, Writing tone | Badge, Button text, headline hook, who it's for, name |

- Picking a badge suggests its button text until the person picks or writes one.
- The Goal banner and Platforms card are gone; Amazon stays on.
- Older all-in-one creations show both, with an "Also make a video ad" switch.
- Saved fields and price are unchanged.

### Generate and results

These are unchanged. The back link in the creation header goes to Ads Creative (`/ads`).

## What goes

- `/ads/books/[id]` (the book page), `EditBookDetails` and the "Your books" grid.
  - Renaming a book is no longer offered. Add it back on the picker if asked.
- `/ads/new` becomes a redirect to `/ads`. The account menu's "Amazon Ads & A+ Content"
  link points to `/ads`.

## Links that change

- Create a book → **Promote this book** goes to `/ads?book=<rootId>`.
- Home's recent Ads card goes to `/ads?book=<rootId>`.
- The upload page for a book being added goes to `/ads/make/<kind>` when `make` is set,
  otherwise to `/ads`.

## Behaviour fixes folded in

- **One unfinished creation per book and type, enforced on the server.**
  `POST /api/ads/projects` with `existingBookId` + `contentGoal` returns the newest child
  of that book with the same goal and no creative set, if one exists, instead of making
  another. This removes duplicate "Unfinished" cards and replaces the UI-only guard.
- `CreateAssetButton` and `AddBookForm` stop spinning if the request throws.

## Data

- `getAdsLibrary(publisherId)` returns `{ books, creations }`:
  - `books`: roots, newest activity first (the picker and the book filter).
  - `creations`: built per book with the existing `groupProjectAssets`. Each version
    (latest and earlier) is one creation; a draft is one "Unfinished" creation.
- The same 60-book cap (`PROJECT_LIMIT`) and ponytail note apply.
- Filtering by type or book happens on that list in the page.

## Testing

- Unit: the creation list from rows (versions and drafts, legacy all-in-one rows split
  by type, newest first).
- DB: `getAdsLibrary` is scoped to the publisher and credits children to their book.
- API: a second start for the same book and type returns the unfinished one, and a start
  after the first was generated makes a new one.
- E2E (rewritten `ads.spec`):
  1. `/ads` → Ad images → add a book by cover → settings → generate → results (keep the
     existing results checks).
  2. Back on `/ads`: the creation shows under All and under Ad images, but not under
     A+ content.
  3. `credits.spec` follows the same path.
