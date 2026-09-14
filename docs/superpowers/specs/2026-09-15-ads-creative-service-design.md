# Ads Creative Service — Design Spec

Date: 2026-09-15
Status: Approved for planning

## Context

Publisher Toolkit is a multi-service platform for book publishers. This is
the first of four planned services:

1. **Ads Creative** (this spec) — generate ad creatives + copy from a book's
   PDF/cover, and let publishers push them directly to Meta/Google Ads.
2. Trailer Video — short preview videos generated from a book's PDF/cover.
3. Audio Book — narrated audiobook from a book's PDF/text + a reference voice
   clip.
4. Landing Page & Website (upcoming/deferred) — hostable landing pages
   generated from a publisher's profile and book catalog.

Each service gets its own design spec and implementation plan. This spec
covers only the Ads Creative service.

## Purpose

Publishers currently have no easy way to produce ad creatives (images + copy)
for running campaigns on Meta, Google, and Amazon. This service takes a
book's PDF (and optionally separate front/back cover images), generates
platform-sized ad images with AI-written copy, and lets the publisher push
the result directly into a connected Meta or Google Ads account.

## Scope (v1)

In scope:
- Publisher signup/login, multi-tenant (each publisher sees only their own
  books and creative sets).
- Book upload: PDF, with optional separate front/back cover image uploads.
- Automatic extraction of cover art and metadata (title, author, blurb) from
  the PDF.
- AI-generated ad copy (headline / primary text / description) per platform,
  in multiple variants.
- Template-based image compositing: cover art + copy composited onto a fixed
  set of designs, at the standard ad sizes for Meta, Google, and Amazon.
- OAuth connection to a publisher's Meta Ads and Google Ads accounts.
- Pushing a generated creative set as a campaign/ad directly via the Meta
  Marketing API and Google Ads API.
- Downloading generated creatives directly (without going through an ad
  account) for manual use elsewhere (e.g. Amazon Marketing Cloud, which has
  no self-serve OAuth API for this).

Out of scope (later phases / other services):
- AI-generated (diffusion-model) background art — v1 uses template
  compositing only, with cover art as the driving asset.
- Async job queue / background workers — v1 processes generation
  synchronously within a single request. Revisit if generation time or
  fan-out (many sizes/platforms) makes this too slow.
- Video/motion creatives — static images + copy only.
- Trailer Video, Audio Book, Landing Page services — separate specs.

## Architecture

Single Next.js (App Router) app deployed on Vercel. No separate backend
service. Server Actions / Route Handlers perform book ingestion, generation,
and ad-platform API calls directly.

- **Framework**: Next.js App Router on Vercel (Fluid Compute).
- **Auth**: Clerk (Vercel Marketplace native integration) for publisher
  signup/login and multi-tenancy.
- **Database**: Postgres via Vercel Marketplace (e.g. Neon) — publishers,
  books, creative sets, connected ad accounts.
- **File storage**: Vercel Blob — uploaded PDFs/covers and generated
  creative images.
- **AI**: Claude via Vercel AI SDK for ad copy generation.
- **Image compositing**: server-side image library (`sharp` and/or
  `@napi-rs/canvas`) rendering fixed templates.
- **Ads connectors**: OAuth 2.0 against Meta Marketing API and Google Ads
  API; stored tokens per publisher per platform.

## Components

### Book ingestion
Publisher uploads a book PDF and optionally separate front/back cover
images. The server:
- Renders the PDF's first page (and last page, if used as back cover) to
  images for use as cover art when no separate cover image is supplied.
- Extracts text metadata: title, author, and enough front-matter/blurb text
  to ground ad copy generation.
- Stores the `Book` record (metadata + file references) in Postgres, files
  in Blob.

If cover extraction fails (e.g. a scanned, image-only, or malformed PDF),
the publisher is prompted to upload front/back cover images manually rather
than the flow failing outright.

### Ad copy generation
Given the book's metadata and blurb text, Claude generates several ad copy
variants (headline / primary text / description) tailored per platform's
copy conventions (Meta, Google, Amazon character limits and tone).

If generation fails, the server retries once. If it still fails, the
creative set is still created with images composited and copy left as an
editable blank, rather than failing the whole request.

### Template compositing
A fixed library of design templates exists per platform ad size (e.g. Meta
feed 1080×1080, Meta story 1080×1920, Google display standard sizes, Amazon
300×250). Each template composites the book's cover art and the generated
copy into a final image, sized correctly for its platform slot. Output
images are stored in Blob and linked to the `CreativeSet` record.

### Ads connectors
Publishers connect their Meta Ads and/or Google Ads account via OAuth. The
service stores the resulting tokens (refreshed as needed) per publisher, per
platform. From a generated creative set, the publisher can push the images +
copy directly as a campaign/ad via the platform's API.

- If a token is expired/revoked, the publisher is prompted to reconnect;
  the push is not silently retried or dropped.
- If the platform's API rejects a campaign or creative (policy violation,
  bad spec, etc.), that platform's own error message is surfaced to the
  publisher as-is — no retry-guessing on the service's part.

Amazon has no public self-serve OAuth API suited to this flow, so Amazon
support in v1 is "download the correctly-sized creative for manual upload,"
not a direct API push.

## Data flow

1. Publisher logs in (Clerk).
2. Publisher creates a Book: uploads PDF (+ optional cover images).
3. Publisher clicks "Generate creatives."
4. Server extracts cover art + metadata (if not already done at upload
   time).
5. Server runs copy generation and template compositing (can run in
   parallel) within the same request.
6. Results are saved as a `CreativeSet` (images in Blob, copy text in
   Postgres) and shown in the dashboard.
7. Publisher downloads creatives directly, and/or connects a Meta/Google Ads
   account (if not already connected) and pushes the set as a campaign.

## Error handling

| Failure | Handling |
|---|---|
| PDF cover/metadata extraction fails | Prompt for manual cover image upload; don't fail the Book creation. |
| Ad copy generation fails | Retry once; on repeated failure, save the creative set with blank/editable copy. |
| Ads OAuth token expired/revoked | Prompt to reconnect; do not silently drop or retry the push. |
| Ads API rejects campaign/creative | Show the platform's own error message to the publisher. |

## Testing

- **Unit**: PDF metadata/cover extraction; template compositing (verify
  output dimensions/format match each platform's spec); ad-copy prompt
  construction and parsing (LLM call mocked).
- **Integration**: OAuth callback handling and token storage/refresh for
  Meta and Google.
- **E2E (Playwright)**: full upload → generate → view creative set flow
  against a real sample PDF.

## Open questions for later phases

- Whether/when to introduce an async job queue (Vercel Queues) if
  generation time or per-request fan-out grows.
- Whether AI-generated (non-template) background art gets added as an
  option once template compositing is proven out.
