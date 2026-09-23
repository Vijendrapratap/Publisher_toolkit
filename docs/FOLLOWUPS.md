# Known follow-ups

Triaged and deliberately deferred. Everything listed here is reachable but not
blocking. Items fixed in the platform-hardening pass are recorded at the bottom
so they are not re-litigated.

## Before anyone sets a real Clerk key

- **`createRouteMatcher` is deprecated** — Clerk logs a warning on every boot.
  Look up the current API once and apply it in `proxy.ts`.
- **No route test covers the protected/public split.** `proxy.ts` is only
  exercised by hand. Worth one test once real keys exist.

## Before enabling Vercel Blob storage

- **Per-tile Download becomes "navigate to image".** `CreativeGallery` uses
  `<a download>`, which browsers honour same-origin (`/api/files/...`) but
  silently ignore cross-origin (`*.blob.vercel-storage.com`). Route those
  downloads through `/api/creatives/[id]/image?download=1`, which already sets
  `Content-Disposition`.
- **Published landing covers are served by `/p/[slug]/cover`,** which proxies
  blob reads through the server. Fine, but it means a public page's images are
  not on the CDN. Consider signing a blob URL instead if traffic warrants it.
- **Uploaded ad-video music assumes a local-storage URL shape.** The upload
  URL rule (`musicSchema` in `lib/services/ads/videoSpec.ts`, currently
  `url: z.string().startsWith('/api/files/')`) and the server-side ownership
  check that reads it (`ownsMusicUpload`/`musicUploadPrefix`, requiring
  `/api/files/ads/${publisherId}/music/...`) both assume `storeFile` returns a
  local `/api/files/...` path. Once Blob is enabled, `storeFile` instead
  returns a `*.blob.vercel-storage.com` URL, which neither check would accept
  — every upload would silently be treated as "no music". Both need to accept
  the Blob URL shape (and the ownership check still needs some way to tie a
  Blob URL back to the owning publisher, e.g. by keeping the publisher/prefix
  segment in the stored pathname and checking it rather than the origin).

## Before a publisher has thousands of projects

- **Library pickers cap at `LIBRARY_ROW_LIMIT` (200) rows** and dedupe in
  application code. Past that, move the dedupe into a `DISTINCT ON` query.
- **The project rail caps at 30.** There is no "see all" view yet beyond the
  service home page.

## Storage lifecycle

- **Orphaned files on failure.** The upload route stores the PDF before
  validating covers, so a cover rejection leaves an unreferenced PDF.
  Re-generating a creative set also orphans the previous set's PNGs. No cleanup
  job exists.
- **Deleting a project leaves its files.** `DELETE` removes rows, not blobs.

## Smaller items

- **`CreativeGallery` tile layout uses viewport breakpoints** (`sm:`/`xl:`)
  inside a much narrower container, so tiles are ~155px when the grid thinks
  they're wider. Container queries would be the real fix.
- **`Field` silently drops its aria wiring when given multiple children**
  (`isValidElement` is false for an array). Latent — no current consumer sets
  `hint`/`error` there.
- **`Dropzone` has two `<label htmlFor>` on one input** in the empty state.
  Accessible names concatenate, which works but is unusual.
- **`AccountChip`** puts `aria-label` on a role-less `<div>`, widely ignored by
  assistive tech.
- **`CreativeGallery`'s `<dialog>` has no accessible name** — add `aria-label`.
- **`generateAiImage` has no callers.** Illustration and line-art prompts are
  generated but never rendered to images. Either wire it into the create-book
  flow or delete it and its `OPENROUTER_IMAGE_MODEL` config.
- **`/api/ads/projects` and `/api/trailer/projects` POST handlers are long**
  (three intake shapes each: JSON, PDF upload, manual FormData). The cover
  handling is shared via `lib/services/shared/upload.ts`; the branching is not.
- **No test posts literally unparsable JSON** to the mutation routes.
- **`AiResult.source` is not persisted.** The results page can tell a trailer
  is missing (stored state) but not that ad copy was sample text — that only
  surfaces as a toast at generation time. Persisting it would need a column.

## Not bugs — deliberate, don't re-litigate

- **Raw `<img>` rather than `next/image`** throughout, because URLs are dynamic
  local-or-blob and no `remotePatterns` are configured.
- **Prisma pinned to 6.x.** Prisma 7 removes `datasource.url` in favour of a
  driver-adapter constructor, which would mean redesigning `lib/db.ts` and every
  consumer.
- **Image rendering has no per-size error isolation** — one failed render fails
  the batch. Deliberate: a partial ad set is not shippable.
- **Ad copy is not composited into the creative images.** Real ad platforms take
  the image as the creative and the copy as separate campaign fields.
- **Ads push is simulated.** `lib/providers/adsPush.ts` says so in its receipt.

## Fixed in the hardening pass

- Build-blocking type error in `getPublisherBookLibrary` (masked by a stale
  `tsconfig.tsbuildinfo`).
- `/api/creatives/[id]/image` served any creative by id, unauthenticated.
- `/api/settings/ai-key` was unauthenticated and wrote the key into
  `.env.local` and `process.env` process-globally. Keys are now per-publisher
  and redacted on every path to the browser.
- SSRF in `/api/extract-url`: no private-address block, no timeout, no size cap.
- `updateCreatorProject` ignored its `publisherId` argument.
- `requireCurrentPublisherId` swallowed Next's dynamic-rendering signal, so
  pages could prerender as the dev publisher.
- `isClerkConfigured` keyed on the secret alone; a half-configured Clerk crashed
  at boot. The `proxy.ts` matcher treated `/sign-in-anything` as public.
- Trailer rendering stored a 32-byte stub `.mp4` when ffmpeg failed and reported
  success; its temp directory was never removed.
- Published landing pages showed a broken cover to every visitor.
- `publishedSlug` collisions threw a 500.
- Asset filenames collided within a millisecond and were always named `.png`.
- Ads image sizes, trailer aspect ratios and audiobook chapters rendered
  serially; the hub and ads rail fetched every row to show four.
