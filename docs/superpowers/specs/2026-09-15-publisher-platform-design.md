# Publisher Toolkit Platform — Design Spec

Date: 2026-09-15
Status: Approved in brainstorming, pending written-spec review
Supersedes (for UI and platform structure): the UI portions of
`2026-09-15-ads-creative-service-design.md`. That spec still governs the Ads
Creative pipeline's behavior (extraction, copy generation, compositing, error
handling, Meta/Google push).

## Context

Publisher Toolkit is a platform for book publishers offering four services:

1. **Ads Creative** — ad images + copy from a book's PDF/cover, push to Meta/Google Ads.
2. **Trailer Video** — short preview videos from a book's PDF/cover.
3. **Audio Book** — narrated audiobook from a book's PDF/text + a reference voice clip.
4. **Landing Page & Website** — hostable landing page from publisher profile + book details.

The Ads Creative pipeline already exists (merged to `main`): upload, PDF
extraction, Claude ad copy, `next/og` compositing at five platform sizes,
creative-set storage. Its UI is a bare functional scaffold. Nothing exists yet
for the other three services, and there is no platform shell.

## Goal

A modern, polished platform publishers enjoy using, structured like an
ilovepdf-style tool hub: one publisher account, independent services, and a
consistent flow across all of them. Build the UI/UX for the whole platform
first, runnable end-to-end locally with no external services, then integrate
real pipelines and agents service by service behind the same screens.

## Product model

- **One account, many independent tools.** A publisher signs in once and lands
  on a hub of four service cards. They open one service at a time and work
  inside it.
- **Per-service data isolation.** Each service owns its own uploads, projects
  and outputs. There is no shared book library across services. Deleting a
  project in one service touches nothing in another.
- **Multi-tenant.** Every row in every service is scoped by `publisherId`. No
  cross-publisher reads or writes, enforced at the query layer (the existing
  `getBookForPublisher` pattern).

## Architecture

Single Next.js App Router app (the existing repo), one route group per
service, shared shell and UI kit. Chosen over (B) a generic `Project` table
with a service discriminator and JSON payloads (blurs isolation, loses typing)
and (C) a monorepo with one app per service (heavy for a local-first
platform).

```
app/
  (platform)/layout.tsx          shell: top bar, service switcher, account menu
  (platform)/page.tsx            hub: four service cards
  (platform)/ads/...             Ads Creative
  (platform)/trailer/...         Trailer Video
  (platform)/audiobook/...       Audio Book
  (platform)/landing/...         Landing Page & Website
  api/<service>/...              per-service route handlers
lib/
  providers/                     local-vs-real capability switches (auth, storage, ai)
  services/<service>/            per-service queries + pipeline interface + stub/real impls
components/
  ui/                            shadcn/ui primitives
  platform/                      shell, stepper, project rail, upload dropzone, empty/error states
```

The existing Ads Creative code moves under `lib/services/ads/` and
`app/(platform)/ads/`; its behavior and tests are preserved.

## Platform shell (shared)

- **Hub (`/`)** — grid of four tool cards (icon, name, one-line promise, "Open"),
  plus a "recent projects" strip per service the publisher has used.
- **Top bar** — logo, service switcher, theme toggle, account menu.
- **Inside a service** — left rail listing that service's projects (newest
  first, "New project" button); main area shows the current step or results.
- **One flow for every service: Upload → Configure → Generate → Results**,
  with a visible stepper. Each step is a URL (`/<service>/<projectId>/<step>`)
  so refresh and back/forward work, and a project can be resumed at the step
  it stopped at.
- **States everywhere** — skeleton loaders, progress during generation (step
  labels, not a bare spinner), toasts for success/failure, designed empty
  states ("No projects yet"), inline error states with a retry action.
- **Responsive** down to tablet width; mobile shows the rail as a drawer.

## Services

Each service has its own Prisma models, queries, API routes and a pipeline
behind a typed interface with a local stub and (later) a real implementation.

### Ads Creative (`/ads`) — real pipeline, new UI
- **Upload**: drag-and-drop PDF, optional front/back cover; shows extracted
  title/author/blurb for confirmation; manual cover prompt when extraction fails.
- **Configure**: platforms (Meta, Google, Amazon) and sizes, copy tone
  (e.g. literary / punchy / bold), template choice with thumbnails.
- **Generate**: staged progress (copy → images).
- **Results**: gallery grouped by platform with true-aspect previews, lightbox,
  editable copy per platform (saved), download one or all as ZIP, and a
  Meta/Google "Connect & push" panel (stubbed locally; real OAuth in a later plan).
- Edited copy is persisted; blank copy from a failed generation is editable,
  matching the ads spec's error-handling rule.

### Trailer Video (`/trailer`) — stub pipeline
- **Upload**: PDF and/or cover image.
- **Configure**: length (15s / 30s / 60s), style (cinematic, minimal, dramatic),
  music mood, aspect ratios (9:16, 1:1, 16:9).
- **Results**: player per aspect ratio with poster frame, download.
- **Local stub**: returns a short bundled sample video + generated poster per ratio.

### Audio Book (`/audiobook`) — stub pipeline
- **Upload**: PDF or text file, plus reference voice clip (with in-browser preview).
- **Configure**: voice (reference clip or preset), pace, detected chapters
  (editable list, include/exclude).
- **Results**: chapter list with per-chapter player and durations, download
  per chapter or full.
- **Local stub**: chapter detection is real (text-based); audio is a bundled
  sample clip per chapter.

### Landing Page & Website (`/landing`) — stub pipeline
- **Upload**: publisher profile (name, bio, logo) and book details + cover.
- **Configure**: template, sections (hero, about the book, author, reviews,
  buy links), colors.
- **Results**: live preview in an iframe (desktop/mobile toggle), export HTML,
  "Publish" (stubbed locally).
- **Local stub**: renders real HTML from the chosen template — no external call
  needed, so this service is fully functional locally from day one.

## Local-first capability switching

Every external capability has a real implementation and a local one, chosen
automatically by whether its credentials are present. No code change to
switch; no external dependency needed to run and click through the platform.

| Capability | Real (when configured) | Local fallback |
|---|---|---|
| Auth | Clerk (`CLERK_SECRET_KEY` real) | Local dev publisher (exists today) |
| File storage | Vercel Blob (`BLOB_READ_WRITE_TOKEN`) | Local store (exists today as data URIs; move to `.local-storage/` files served by an API route so large files don't bloat the DB) |
| Ad copy AI | Claude via AI Gateway | Realistic sample copy derived from title/author/blurb (not blank) |
| Trailer / Audio / Landing pipelines | Real agents (later plans) | Stubs above |
| Meta / Google push | OAuth + APIs (later plan) | Simulated connect + push with a success receipt |
| Database | Postgres via `DATABASE_URL` | Embedded Postgres via `scripts/test-db.mjs` |

The switch logic lives in `lib/providers/`, one module per capability, so
pipelines never check env vars directly. A small "Local mode" badge in the
account menu shows which capabilities are simulated.

**One-command local run**: `npm run dev` starts the embedded Postgres (if no
`DATABASE_URL`), applies migrations, and starts Next.js — no manual steps.

## Look and feel

- **Character**: a calm, premium "publishing studio" — not a generic admin panel.
- **Kit**: shadcn/ui on the existing Tailwind v4, with project design tokens
  (color, radius, spacing, shadow) defined once and used everywhere.
- **Type**: serif display face for headings (e.g. Fraunces) paired with a
  clean sans for UI (e.g. Inter), loaded via `next/font`.
- **Color**: warm neutral base, one confident accent; each service gets a
  subtle secondary tint for its icon/card so the hub is scannable. Light and
  dark themes.
- **Motion**: only where it communicates — step transitions, generation
  progress, results appearing. Respects reduced-motion.
- **Accessibility**: keyboard-navigable flows, visible focus, AA contrast,
  labelled controls, alt text on all generated previews.

## Error handling

Inherits the Ads Creative spec's rules (manual cover on extraction failure,
retry-once-then-editable-blank copy, reconnect prompt on expired tokens,
platform errors shown verbatim). Platform-wide additions:

- Every generate step is resumable: a failed generation returns the project
  to Configure with the error shown inline and a "Try again" action.
- Upload validation (type, size) happens client-side before upload and again
  server-side, with the reason shown in the dropzone.
- Unexpected server errors show a friendly error state with a retry, never a
  raw 500 page.

## Testing

- Existing unit/integration tests are kept and pass after the move.
- Each pipeline interface gets a **contract test** run against the stub, so a
  future real implementation must satisfy the same contract.
- Per-service query tests verify `publisherId` scoping against the real
  embedded Postgres.
- **Playwright e2e per service**, running fully locally in local mode:
  create project → upload → configure → generate → results visible.
- Visual check of every screen in a real browser (light and dark) before a
  service's UI is called done.

## Delivery order

1. Platform shell, design system, hub, provider switches, one-command local run.
2. Ads Creative moved into the shell with its full UI (real pipeline).
3. Landing Page & Website (fully functional locally — HTML templates).
4. Trailer Video UI + stub pipeline.
5. Audio Book UI + stub pipeline.

Each step ends with the platform runnable and clickable end-to-end.

## Out of scope for this spec

- Real Trailer Video and Audio Book generation models/agents, real Landing
  Page hosting, and real Meta/Google OAuth push — each gets its own plan once
  the UI and stubs are in place.
- Billing, teams/multi-user accounts, and cross-service shared book libraries.
