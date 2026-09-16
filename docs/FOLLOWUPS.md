# Known follow-ups

Captured from the final whole-branch review of the platform shell + Ads Creative work. Everything here was found, triaged and deliberately deferred — none of it blocks local use.

## Before anyone sets a real Clerk key

These three are one piece of work. They are unreachable in local mode (Clerk's middleware is never constructed), but the first is auth-bypass-shaped and must be fixed before real credentials exist.

- **`proxy.ts` route matcher is too broad.** `'/((?!sign-in|sign-up).*)'` also treats `/sign-in-anything` as public. Fix: `createRouteMatcher(['/((?!sign-in(?:/|$)|sign-up(?:/|$)).*)'])`.
- **Half-configured Clerk crashes.** `isClerkConfigured()` keys on `CLERK_SECRET_KEY` alone, so setting the secret without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` mounts `ClerkProvider` and `clerkMiddleware` with no publishable key. Check both.
- **`createRouteMatcher` is deprecated** — Clerk logs a warning on every boot. Look up the current API once and apply it here.

## Before enabling Vercel Blob storage

- **Per-tile Download becomes "navigate to image".** `CreativeGallery` uses `<a download>`, which browsers honour same-origin (`/api/files/...`) but silently ignore cross-origin (`*.blob.vercel-storage.com`). Route downloads through an endpoint when blob mode lands.
- **Cover files are always named `*.png`** regardless of the accepted jpeg/webp type. In blob mode the stored content type is correct; in local mode `/api/files` re-derives it from the extension and serves a JPEG as `image/png`. Derive the extension from the type.

## Before a publisher has many projects

- **Unbounded queries.** The hub fetches every book then slices to 4; the Ads layout fetches every book for the rail on every `/ads/**` render. Add `take` to `getBooksForPublisher` while the call sites are still two.

## Before the second service (Trailer / Audio Book / Landing Page)

- **Generic components import Ads-specific helpers.** `ProjectRail` imports `statusDisplay` and `Dropzone` imports `validation` from `lib/services/ads/`. Fine while Ads is the only live service; generalise when the second one lands. This is the one structural debt that gets more expensive, not less.

## Smaller items

- **Orphaned files on failure.** The upload route stores the PDF before validating covers, so a cover rejection leaves an unreferenced PDF. Re-generating a creative set also orphans the previous set's PNGs. No cleanup job exists.
- **`CreativeGallery` tile layout uses viewport breakpoints** (`sm:`/`xl:`) inside a much narrower container, so tiles are ~155px when the grid thinks they're wider. The caption row works around this with `flex-wrap`; container queries would be the real fix.
- **`/api/files` returns plain text on 404** while every other route returns `{ error }`. Breaks a generic client-side `json.error` read.
- **`Field` silently drops its aria wiring when given multiple children** (`isValidElement` is false for an array). Latent — no current consumer sets `hint`/`error` there.
- **`author` clamp is untested.** `extractBookAssets` clamps title/author/blurb to the update schema's caps, but the test only exercises title and blurb.
- **`Dropzone` has two `<label htmlFor>` on one input** in the empty state (visible label + drop-target wrapper). Accessible names concatenate, which works but is unusual.
- **`AccountChip`** puts `aria-label` on a role-less `<div>`, widely ignored by assistive tech.
- **`CreativeGallery`'s `<dialog>` has no accessible name** — add `aria-label`.
- **Coming-soon pages bake capability status at build time** (`/trailer`, `/audiobook`, `/landing` prerender), so a build-without-keys deployed-with-keys would show a stale "Local mode" badge.
- **Hub "Pick up where you left off" sorts by `createdAt`** while displaying `updatedAt`, so a recently-edited older project won't surface.
- **Minor consistency:** duplicated error-banner markup in three forms; `PLATFORMS` not `as const`; `steps.ts` helpers typed `status: string` rather than `ProjectStatus`; the cover+details save is two PATCHes; `CONTENT_TYPES` falls back silently to `application/octet-stream`; no test posts literally unparsable JSON.

## Not bugs — deliberate, don't re-litigate

- **Raw `<img>` rather than `next/image`** throughout, because URLs are dynamic local-or-blob and no `remotePatterns` are configured.
- **Prisma pinned to 6.x.** Prisma 7 removes `datasource.url` in favour of a driver-adapter constructor, which would mean redesigning `lib/db.ts` and every consumer.
- **Image rendering has no per-size error isolation** — one failed render fails the batch. The spec's "must not fail outright" rule is explicit for ad copy only.
- **Ad copy is not composited into the creative images.** Real ad platforms take the image as the creative and the copy as separate campaign fields.
