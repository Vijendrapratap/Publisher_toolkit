# Platform Shell + Ads Creative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Ads Creative scaffold into the first service of a polished, ilovepdf-style Publisher Toolkit platform — shared shell, design system, hub of four services, local-first capability switching, one-command local run, and the full Upload → Configure → Generate → Results flow for Ads Creative.

**Architecture:** One Next.js App Router app. A `(platform)` route group holds the shell, the hub and one folder per service. Ads Creative code moves under `lib/services/ads/` and `app/api/ads/`. Every external capability (auth, file storage, AI copy, ads push) is reached through `lib/providers/*`, which picks the real implementation when credentials exist and a local one otherwise. Trailer Video, Audio Book and Landing Page appear on the hub as "coming soon" — each gets its own later plan.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19, Tailwind CSS v4, Prisma 6.19.3 + Postgres (embedded-postgres locally), Clerk (optional), Vercel Blob (optional), Vercel AI SDK 7 (optional), `next/og`, lucide-react, sonner, jszip, @fontsource-variable (Inter, Fraunces), Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-15-publisher-platform-design.md` (platform + UI), `docs/superpowers/specs/2026-09-15-ads-creative-service-design.md` (Ads Creative pipeline behavior).

## Global Constraints

- The whole platform must run locally with **no external service and no `.env.local`**: `npm run dev` alone starts it.
- A capability switches to its real implementation only when its credential is set; no code change to switch.
- Multi-tenant: every query that reads or writes a service's rows is scoped by `publisherId` at the query layer.
- Per-service data isolation: Ads Creative data lives only in `Book`/`CreativeSet`/`AdCopy`/`CreativeImage`; no shared library tables.
- Flow for every service: **Upload → Configure → Generate → Results**, one URL per step: `/<service>/<projectId>/<step>`.
- Ad sizes (unchanged): Meta feed 1080×1080, Meta story 1080×1920, Google display 300×250 and 728×90, Amazon 300×250.
- PDF extraction failure → prompt for manual cover, never fail project creation.
- Ad copy failure after one retry → the creative set is still created with **blank, editable** copy rows.
- Generation failure → project returns to Configure with the error shown inline and a "Try again" action; never a raw 500 page.
- Uploads validated client-side and server-side: PDF ≤ 25 MB (`application/pdf`); covers ≤ 10 MB (`image/png`, `image/jpeg`, `image/webp`).
- Accessibility: keyboard-navigable, visible focus rings, AA contrast, labelled controls, alt text on every generated preview. Respect `prefers-reduced-motion`.
- Light and dark themes on every screen.
- No runtime network fetches for fonts (self-hosted via `@fontsource-variable`).
- Dev data and test data use **different databases** on the same embedded Postgres: `publisher_toolkit_dev` (dev) and `ads_creative_test` (tests), because tests `deleteMany()`.
- Tests: run DB-backed tests with `npx dotenv -e .env.test -- npx vitest run <file>`; start the DB with `node scripts/test-db.mjs &` if port 5432 is not listening.
- Commits end with the session's attribution trailer lines.

---

## File Structure

```
app/
  layout.tsx                              root: fonts, theme bootstrap script, Toaster, optional ClerkProvider
  globals.css                             design tokens (light/dark), base styles
  (platform)/
    layout.tsx                            TopBar + page container
    page.tsx                              hub: four service cards + recent Ads projects
    error.tsx                             friendly error state with retry
    not-found.tsx                         friendly 404
    trailer/page.tsx                      coming soon
    audiobook/page.tsx                    coming soon
    landing/page.tsx                      coming soon
    ads/
      layout.tsx                          ProjectRail + main area
      page.tsx                            empty state / pick a project
      new/page.tsx                        Upload step for a new project
      [projectId]/
        layout.tsx                        loads project (scoped) + Stepper
        page.tsx                          redirect to resume step
        upload/page.tsx                   review extracted details, manual cover
        configure/page.tsx                platforms, tone, template
        generate/page.tsx                 staged progress runner
        results/page.tsx                  gallery, copy editor, zip, push panel
  api/
    files/[...path]/route.ts              serves locally-stored files (scoped)
    ads/
      projects/route.ts                   POST create project (upload)
      projects/[id]/route.ts              PATCH details/config (json) or covers (multipart)
      projects/[id]/generate/route.ts     POST generate creative set
      projects/[id]/download/route.ts     GET zip of latest set
      projects/[id]/push/route.ts         POST push to Meta/Google (simulated locally)
      copies/[id]/route.ts                PATCH edit one ad copy
lib/
  db.ts                                   Prisma client (unchanged)
  providers/
    auth.ts                               Clerk ⇄ local publisher
    storage.ts                            Vercel Blob ⇄ .local-storage/
    ai.ts                                 AI Gateway configured?
    adsPush.ts                            Meta/Google push ⇄ simulated receipt
    status.ts                             capability status for the Local mode badge
  services/
    registry.ts                           the four services (name, tagline, href, icon, tint, availability)
    ads/
      queries.ts                          all scoped Ads queries
      extract.ts, testFixtures.ts         PDF extraction (moved)
      copy.ts                             generateAdCopy (moved; tone + local sample fallback)
      sampleCopy.ts                       deterministic local sample copy
      render.tsx, pngSize.ts              renderCreativeImages (moved; template + platform filter)
      CreativeTemplate.tsx                satori template (moved; palettes)
      sizes.ts                            CREATIVE_SIZES (moved)
      options.ts                          PLATFORMS, TONES, TEMPLATES + zod schemas
      steps.ts                            step list + resume/completion logic
      validation.ts                       shared upload validation constants + fn
components/
  ui/
    cn.ts                                 className merge
    button.tsx, card.tsx, badge.tsx, field.tsx
  platform/
    TopBar.tsx, ServiceSwitcher.tsx, ThemeToggle.tsx, LocalModeBadge.tsx, AccountChip.tsx
    ServiceIcon.tsx, ServiceCard.tsx, ComingSoon.tsx
    ProjectRail.tsx, RailLink.tsx, Stepper.tsx, Dropzone.tsx, EmptyState.tsx
  ads/
    NewProjectForm.tsx, DetailsReview.tsx, ConfigureForm.tsx, GenerateRunner.tsx
    CreativeGallery.tsx, CopyEditor.tsx, PushPanel.tsx
scripts/
  embedded-db.mjs                         shared embedded Postgres starter
  test-db.mjs                             test DB (uses embedded-db.mjs)
  dev.mjs                                 one-command local run
e2e/
  ads.spec.ts                             full local flow + light/dark screenshots
```

---
### Task 1: Move Ads Creative code under `lib/services/ads` and `app/api/ads`

A pure move with no behavior change, so every later task works against the final layout. The old `/dashboard` pages stay working until Task 14 deletes them.

**Files:**
- Move: `lib/pdf/extract.ts` → `lib/services/ads/extract.ts` (+ `extract.test.ts`, `testFixtures.ts`)
- Move: `lib/ai/generateAdCopy.ts` → `lib/services/ads/copy.ts` (+ test → `copy.test.ts`)
- Move: `lib/compositing/renderCreativeImages.tsx` → `lib/services/ads/render.tsx` (+ test → `render.test.ts`), `lib/compositing/pngSize.ts` → `lib/services/ads/pngSize.ts`
- Move: `lib/templates/CreativeTemplate.tsx` → `lib/services/ads/CreativeTemplate.tsx`, `lib/templates/specs.ts` → `lib/services/ads/sizes.ts`
- Create: `lib/services/ads/queries.ts`, `lib/services/ads/queries.test.ts` (merge of `lib/books/queries*` and `lib/creativeSets/queries*`, which are deleted)
- Move: `app/api/books/route.ts` → `app/api/ads/projects/route.ts`, `app/api/books/[id]/route.ts` → `app/api/ads/projects/[id]/route.ts`, `app/api/books/[id]/generate/route.ts` → `app/api/ads/projects/[id]/generate/route.ts` (each with its `route.test.ts`)
- Modify: `app/dashboard/page.tsx`, `app/dashboard/books/[id]/page.tsx`, `app/dashboard/books/[id]/GenerateButton.tsx`, `app/dashboard/books/new/page.tsx`, `proxy.ts`

**Interfaces:**
- Produces (import paths every later task uses):
  - `@/lib/services/ads/extract` → `extractBookAssets(pdfBytes: Buffer): Promise<ExtractedBookAssets>`
  - `@/lib/services/ads/copy` → `generateAdCopy(book: { title: string; author: string; blurb: string }): Promise<AdCopyResult[]>`, `type AdPlatform = 'META' | 'GOOGLE' | 'AMAZON'`, `interface AdCopyResult`
  - `@/lib/services/ads/render` → `renderCreativeImages(input: { coverImageUrl: string; title: string; author: string }): Promise<RenderedCreativeImage[]>`
  - `@/lib/services/ads/sizes` → `CREATIVE_SIZES: CreativeSizeSpec[]`, `interface CreativeSizeSpec`
  - `@/lib/services/ads/queries` → `getBooksForPublisher(publisherId)`, `getBookForPublisher(publisherId, bookId)`, `getLatestCreativeSetForBook(bookId, publisherId)`
  - HTTP: `POST /api/ads/projects`, `PATCH /api/ads/projects/:id`, `POST /api/ads/projects/:id/generate`

- [ ] **Step 1: Confirm the suite is green before moving anything**

Run: `ss -ltnp | grep 5432 || (node scripts/test-db.mjs > /tmp/test-db.log 2>&1 &) ; sleep 3; npx dotenv -e .env.test -- npx vitest run`
Expected: `Test Files 11 passed (11)`, `Tests 30 passed (30)`

- [ ] **Step 2: Move the files with git so history follows them**

```bash
mkdir -p lib/services/ads app/api/ads/projects/\[id\]/generate
git mv lib/pdf/extract.ts lib/services/ads/extract.ts
git mv lib/pdf/extract.test.ts lib/services/ads/extract.test.ts
git mv lib/pdf/testFixtures.ts lib/services/ads/testFixtures.ts
git mv lib/ai/generateAdCopy.ts lib/services/ads/copy.ts
git mv lib/ai/generateAdCopy.test.ts lib/services/ads/copy.test.ts
git mv lib/compositing/renderCreativeImages.tsx lib/services/ads/render.tsx
git mv lib/compositing/renderCreativeImages.test.ts lib/services/ads/render.test.ts
git mv lib/compositing/pngSize.ts lib/services/ads/pngSize.ts
git mv lib/templates/CreativeTemplate.tsx lib/services/ads/CreativeTemplate.tsx
git mv lib/templates/specs.ts lib/services/ads/sizes.ts
git mv app/api/books/route.ts app/api/ads/projects/route.ts
git mv app/api/books/route.test.ts app/api/ads/projects/route.test.ts
git mv app/api/books/\[id\]/route.ts app/api/ads/projects/\[id\]/route.ts
git mv app/api/books/\[id\]/route.test.ts app/api/ads/projects/\[id\]/route.test.ts
git mv app/api/books/\[id\]/generate/route.ts app/api/ads/projects/\[id\]/generate/route.ts
git mv app/api/books/\[id\]/generate/route.test.ts app/api/ads/projects/\[id\]/generate/route.test.ts
```

- [ ] **Step 3: Rewrite import paths and API URLs**

```bash
FILES=$(grep -rlE "@/lib/(pdf|ai|compositing|templates)|renderCreativeImages'|generateAdCopy'|/api/books" app lib proxy.ts e2e)
sed -i \
  -e "s#@/lib/pdf/extract#@/lib/services/ads/extract#g" \
  -e "s#@/lib/ai/generateAdCopy#@/lib/services/ads/copy#g" \
  -e "s#@/lib/compositing/renderCreativeImages#@/lib/services/ads/render#g" \
  -e "s#@/lib/templates/specs#@/lib/services/ads/sizes#g" \
  -e "s#@/lib/templates/CreativeTemplate#@/lib/services/ads/CreativeTemplate#g" \
  -e "s#from './generateAdCopy'#from './copy'#g" \
  -e "s#from './renderCreativeImages'#from './render'#g" \
  -e "s#/api/books#/api/ads/projects#g" \
  $FILES
sed -i \
  -e "s#@/lib/books/queries#@/lib/services/ads/queries#g" \
  -e "s#@/lib/creativeSets/queries#@/lib/services/ads/queries#g" \
  $(grep -rlE "@/lib/(books|creativeSets)/queries" app lib)
```

Then in `proxy.ts` the protected matcher becomes:

```ts
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/api/ads(.*)'])
```

- [ ] **Step 4: Merge the two query modules into `lib/services/ads/queries.ts`**

```ts
import { prisma } from '@/lib/db'
import type { Book } from '@prisma/client'

export function getBooksForPublisher(publisherId: string): Promise<Book[]> {
  return prisma.book.findMany({ where: { publisherId }, orderBy: { createdAt: 'desc' } })
}

export function getBookForPublisher(publisherId: string, bookId: string): Promise<Book | null> {
  return prisma.book.findFirst({ where: { id: bookId, publisherId } })
}

export function getLatestCreativeSetForBook(bookId: string, publisherId: string) {
  return prisma.creativeSet.findFirst({
    where: { bookId, book: { publisherId } },
    orderBy: { createdAt: 'desc' },
    include: { adCopies: true, images: true },
  })
}
```

Create `lib/services/ads/queries.test.ts` by concatenating the bodies of `lib/books/queries.test.ts` and `lib/creativeSets/queries.test.ts` into one file with a single import block:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getBooksForPublisher, getBookForPublisher, getLatestCreativeSetForBook } from './queries'

afterEach(async () => {
  await prisma.creativeImage.deleteMany()
  await prisma.adCopy.deleteMany()
  await prisma.creativeSet.deleteMany()
  await prisma.book.deleteMany()
})

describe('book queries', () => {
  it('only returns books belonging to the given publisher', async () => {
    await prisma.book.create({ data: { publisherId: 'pub_a', pdfUrl: 'x' } })
    const bookB = await prisma.book.create({ data: { publisherId: 'pub_b', pdfUrl: 'y' } })

    expect(await getBooksForPublisher('pub_a')).toHaveLength(1)
    expect(await getBookForPublisher('pub_a', bookB.id)).toBeNull()
  })
})

describe('getLatestCreativeSetForBook', () => {
  it('returns the most recent creative set with its copy and images', async () => {
    const book = await prisma.book.create({ data: { publisherId: 'pub_1', pdfUrl: 'x' } })
    await prisma.creativeSet.create({ data: { bookId: book.id } })
    const latest = await prisma.creativeSet.create({
      data: {
        bookId: book.id,
        adCopies: { create: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] },
        images: { create: [{ platform: 'META', sizeKey: 'meta_feed_1080x1080', width: 1080, height: 1080, imageUrl: 'https://x/img.png' }] },
      },
    })

    const result = await getLatestCreativeSetForBook(book.id, 'pub_1')
    expect(result?.id).toBe(latest.id)
    expect(result?.adCopies).toHaveLength(1)
    expect(result?.images).toHaveLength(1)
  })

  it('returns null when the book does not belong to the given publisher', async () => {
    const book = await prisma.book.create({ data: { publisherId: 'pub_1', pdfUrl: 'x' } })
    await prisma.creativeSet.create({ data: { bookId: book.id } })
    expect(await getLatestCreativeSetForBook(book.id, 'pub_2')).toBeNull()
  })
})
```

```bash
git rm lib/books/queries.ts lib/books/queries.test.ts lib/creativeSets/queries.ts lib/creativeSets/queries.test.ts
git add lib/services/ads/queries.ts lib/services/ads/queries.test.ts
```

- [ ] **Step 5: Verify nothing references the old paths**

Run: `grep -rnE "@/lib/(pdf|ai|compositing|templates|books|creativeSets)|/api/books" app lib proxy.ts e2e`
Expected: no output.

- [ ] **Step 6: Type-check, test, build**

Run: `npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build`
Expected: tsc exits 0; `Tests 30 passed (30)` (the merged query test file still holds 3 tests); build lists `ƒ /api/ads/projects`, `ƒ /api/ads/projects/[id]`, `ƒ /api/ads/projects/[id]/generate`.

- [ ] **Step 7: Commit**

```bash
git add -A app lib proxy.ts
git commit -m "refactor: move Ads Creative code under lib/services/ads and app/api/ads"
```

---

### Task 2: Auth, AI and status providers

Moves auth into `lib/providers/auth.ts` and changes what counts as "configured": an **unset** `CLERK_SECRET_KEY` now means local mode. Today only the literal placeholder does, which breaks the no-`.env.local` requirement. Adds the AI switch with a sample-copy fallback and a status summary for the Local mode badge.

**Files:**
- Move: `lib/auth.ts` → `lib/providers/auth.ts`, `lib/auth.test.ts` → `lib/providers/auth.test.ts`
- Create: `lib/providers/ai.ts`, `lib/providers/status.ts`, `lib/providers/status.test.ts`
- Create: `lib/services/ads/sampleCopy.ts`, `lib/services/ads/sampleCopy.test.ts`
- Modify: `lib/services/ads/copy.ts`, `lib/services/ads/copy.test.ts`, every importer of `@/lib/auth` (`app/layout.tsx`, `proxy.ts`, API routes and their tests, dashboard pages)

**Interfaces:**
- Consumes: `generateAdCopy`, `AdCopyResult`, `AdPlatform` from Task 1.
- Produces:
  - `@/lib/providers/auth` → `isClerkConfigured(): boolean`, `requireCurrentPublisherId(): Promise<string>`, `class UnauthenticatedError`, `DEV_PUBLISHER_ID = 'dev-local-publisher'`
  - `@/lib/providers/ai` → `isAiConfigured(): boolean`
  - `@/lib/providers/status` → `type CapabilityMode = 'real' | 'local'`, `getCapabilityStatus(): { auth: CapabilityMode; storage: CapabilityMode; ai: CapabilityMode; adsPush: CapabilityMode }`, `isFullyLocal(status): boolean`
  - `@/lib/services/ads/sampleCopy` → `sampleAdCopy(book: { title: string; author: string; blurb: string }, tone?: string): AdCopyResult[]` (one variant for each of META, GOOGLE, AMAZON)

- [ ] **Step 1: Move the auth module**

```bash
mkdir -p lib/providers
git mv lib/auth.ts lib/providers/auth.ts
git mv lib/auth.test.ts lib/providers/auth.test.ts
sed -i "s#@/lib/auth#@/lib/providers/auth#g" $(grep -rl "@/lib/auth" app lib proxy.ts)
```

- [ ] **Step 2: Write the failing auth tests for the new "unset means local" rule**

Replace `lib/providers/auth.test.ts` with:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))

import { auth } from '@clerk/nextjs/server'
import { requireCurrentPublisherId, UnauthenticatedError, isClerkConfigured, DEV_PUBLISHER_ID } from './auth'

const original = process.env.CLERK_SECRET_KEY
afterEach(() => {
  if (original === undefined) delete process.env.CLERK_SECRET_KEY
  else process.env.CLERK_SECRET_KEY = original
})

describe('isClerkConfigured', () => {
  it('is false when the key is unset', () => {
    delete process.env.CLERK_SECRET_KEY
    expect(isClerkConfigured()).toBe(false)
  })

  it('is false for the placeholder key', () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder'
    expect(isClerkConfigured()).toBe(false)
  })

  it('is true for a real-looking key', () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_abc123'
    expect(isClerkConfigured()).toBe(true)
  })
})

describe('requireCurrentPublisherId', () => {
  it('returns the local publisher id without calling Clerk in local mode', async () => {
    delete process.env.CLERK_SECRET_KEY
    await expect(requireCurrentPublisherId()).resolves.toBe(DEV_PUBLISHER_ID)
    expect(auth).not.toHaveBeenCalled()
  })

  it('returns the Clerk userId when signed in', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_abc123'
    vi.mocked(auth).mockResolvedValue({ userId: 'pub_123' } as any)
    await expect(requireCurrentPublisherId()).resolves.toBe('pub_123')
  })

  it('throws UnauthenticatedError when signed out', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_abc123'
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)
    await expect(requireCurrentPublisherId()).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})
```

- [ ] **Step 3: Run it to verify the unset-key test fails**

Run: `npx vitest run lib/providers/auth.test.ts`
Expected: FAIL. `is false when the key is unset` gets `true`, and `DEV_PUBLISHER_ID` is not exported.

- [ ] **Step 4: Update `lib/providers/auth.ts`**

```ts
import { auth } from '@clerk/nextjs/server'

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthenticatedError'
  }
}

// Local mode: no Clerk key (or the .env.example placeholder) means every
// request acts as one fixed local publisher. Set a real key and real auth
// takes over with no code change.
export const DEV_PUBLISHER_ID = 'dev-local-publisher'

export function isClerkConfigured(): boolean {
  const key = process.env.CLERK_SECRET_KEY
  return Boolean(key) && key !== 'sk_test_placeholder'
}

export async function requireCurrentPublisherId(): Promise<string> {
  if (!isClerkConfigured()) return DEV_PUBLISHER_ID
  const { userId } = await auth()
  if (!userId) throw new UnauthenticatedError()
  return userId
}
```

- [ ] **Step 5: Run the auth tests**

Run: `npx vitest run lib/providers/auth.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Write the failing sample-copy test**

`lib/services/ads/sampleCopy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sampleAdCopy } from './sampleCopy'

const book = { title: 'The Lazy Developer', author: 'Jane Coder', blurb: 'A story about shipping less code.' }

describe('sampleAdCopy', () => {
  it('returns one variant per platform, grounded in the book', () => {
    const copy = sampleAdCopy(book)
    expect(copy.map((c) => c.platform)).toEqual(['META', 'GOOGLE', 'AMAZON'])
    for (const c of copy) {
      expect(c.headline.length).toBeGreaterThan(0)
      expect(c.primaryText.length).toBeGreaterThan(0)
      expect(c.description.length).toBeGreaterThan(0)
    }
    expect(copy[2].headline).toContain('The Lazy Developer')
  })

  it('respects platform length limits', () => {
    const copy = sampleAdCopy({ ...book, title: 'A'.repeat(200) })
    expect(copy[0].headline.length).toBeLessThanOrEqual(40)
    expect(copy[0].primaryText.length).toBeLessThanOrEqual(125)
    expect(copy[1].headline.length).toBeLessThanOrEqual(30)
    expect(copy[1].description.length).toBeLessThanOrEqual(90)
  })

  it('changes wording with tone', () => {
    expect(sampleAdCopy(book, 'punchy')[0].headline).not.toBe(sampleAdCopy(book, 'literary')[0].headline)
  })

  it('handles missing metadata', () => {
    const copy = sampleAdCopy({ title: '', author: '', blurb: '' })
    expect(copy[0].headline).toContain('Your next great read')
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run lib/services/ads/sampleCopy.test.ts`
Expected: FAIL, `Cannot find module './sampleCopy'`

- [ ] **Step 8: Implement `lib/services/ads/sampleCopy.ts`**

```ts
import type { AdCopyResult } from './copy'

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

const HOOKS: Record<string, (title: string) => string> = {
  literary: (t) => `Lose yourself in ${t}`,
  punchy: (t) => `${t}. Don't miss it.`,
  bold: (t) => `${t} changes everything`,
}

// Local-mode stand-in for Claude: believable, length-safe copy built from the
// book's own metadata, so the Results screen is never empty offline.
export function sampleAdCopy(book: { title: string; author: string; blurb: string }, tone = 'literary'): AdCopyResult[] {
  const title = book.title.trim() || 'Your next great read'
  const byline = book.author.trim() ? ` by ${book.author.trim()}` : ''
  const blurb = book.blurb.trim() || `Discover ${title}${byline}.`
  const hook = (HOOKS[tone] ?? HOOKS.literary)(title)

  return [
    {
      platform: 'META',
      headline: clip(hook, 40),
      primaryText: clip(blurb, 125),
      description: clip(`${title}${byline}`, 90),
    },
    {
      platform: 'GOOGLE',
      headline: clip(title, 30),
      primaryText: clip(hook, 90),
      description: clip(blurb, 90),
    },
    {
      platform: 'AMAZON',
      headline: clip(`${title}${byline}`, 80),
      primaryText: clip(blurb, 150),
      description: clip(hook, 90),
    },
  ]
}
```

- [ ] **Step 9: Run it**

Run: `npx vitest run lib/services/ads/sampleCopy.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 10: Add the AI provider and wire the fallback into `copy.ts`**

`lib/providers/ai.ts`:

```ts
// The AI Gateway authenticates with an API key or a Vercel OIDC token.
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)
}
```

In `lib/services/ads/copy.ts`, add the imports and change the exported function (the `attemptGeneration` helper and the schema stay as they are):

```ts
import { isAiConfigured } from '@/lib/providers/ai'
import { sampleAdCopy } from './sampleCopy'

export async function generateAdCopy(book: { title: string; author: string; blurb: string }): Promise<AdCopyResult[]> {
  if (!isAiConfigured()) return sampleAdCopy(book)
  try {
    return await attemptGeneration(book)
  } catch {
    try {
      return await attemptGeneration(book)
    } catch {
      return []
    }
  }
}
```

In `lib/services/ads/copy.test.ts`, the existing tests exercise the real path. Add this at the top of the `describe` block so they keep doing so, then add a local-mode test:

```ts
import { beforeEach, afterEach } from 'vitest'

beforeEach(() => { process.env.AI_GATEWAY_API_KEY = 'test-key' })
afterEach(() => { delete process.env.AI_GATEWAY_API_KEY; vi.mocked(generateText).mockReset() })

it('uses local sample copy without calling the model when AI is not configured', async () => {
  delete process.env.AI_GATEWAY_API_KEY
  const result = await generateAdCopy(book)
  expect(result).toHaveLength(3)
  expect(generateText).not.toHaveBeenCalled()
})
```

- [ ] **Step 11: Write the failing status test**

`lib/providers/status.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { getCapabilityStatus, isFullyLocal } from './status'

const keys = ['CLERK_SECRET_KEY', 'BLOB_READ_WRITE_TOKEN', 'AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN'] as const
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('getCapabilityStatus', () => {
  it('reports everything local when no credentials are set', () => {
    for (const k of keys) delete process.env[k]
    const status = getCapabilityStatus()
    expect(status).toEqual({ auth: 'local', storage: 'local', ai: 'local', adsPush: 'local' })
    expect(isFullyLocal(status)).toBe(true)
  })

  it('reports real per capability as credentials appear', () => {
    for (const k of keys) delete process.env[k]
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_x'
    const status = getCapabilityStatus()
    expect(status.storage).toBe('real')
    expect(status.auth).toBe('local')
    expect(isFullyLocal(status)).toBe(false)
  })
})
```

- [ ] **Step 12: Implement `lib/providers/status.ts`**

`adsPush` is always local in this plan. Real Meta/Google OAuth is a later plan.

```ts
import { isClerkConfigured } from './auth'
import { isAiConfigured } from './ai'

export type CapabilityMode = 'real' | 'local'

export interface CapabilityStatus {
  auth: CapabilityMode
  storage: CapabilityMode
  ai: CapabilityMode
  adsPush: CapabilityMode
}

const mode = (real: boolean): CapabilityMode => (real ? 'real' : 'local')

export function getCapabilityStatus(): CapabilityStatus {
  return {
    auth: mode(isClerkConfigured()),
    storage: mode(Boolean(process.env.BLOB_READ_WRITE_TOKEN)),
    ai: mode(isAiConfigured()),
    adsPush: 'local',
  }
}

export function isFullyLocal(status: CapabilityStatus): boolean {
  return Object.values(status).every((m) => m === 'local')
}
```

- [ ] **Step 13: Run everything**

Run: `npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run`
Expected: tsc exits 0, and all test files pass, including the new `auth`, `sampleCopy`, `status` and `copy` tests.

- [ ] **Step 14: Commit**

```bash
git add -A lib app proxy.ts
git commit -m "feat: add auth/ai/status providers with local fallbacks and sample ad copy"
```

---

### Task 3: Storage provider with a local file store

Replaces `lib/blob.ts` (data URIs) with `lib/providers/storage.ts`. Locally, files are written to `.local-storage/` and served by a publisher-scoped route. Compositing needs an absolute image URL, so the generate route reads the stored cover and passes it as a data URI.

**Files:**
- Create: `lib/providers/storage.ts`, `lib/providers/storage.test.ts`
- Create: `app/api/files/[...path]/route.ts`, `app/api/files/[...path]/route.test.ts`
- Delete: `lib/blob.ts`, `lib/blob.test.ts`
- Modify: `app/api/ads/projects/route.ts` (+test), `app/api/ads/projects/[id]/route.ts` (+test), `app/api/ads/projects/[id]/generate/route.ts` (+test), `.gitignore`

**Interfaces:**
- Consumes: `requireCurrentPublisherId` from Task 2.
- Produces (`@/lib/providers/storage`):
  - `isBlobConfigured(): boolean`
  - `storeFile(pathname: string, data: Buffer, contentType: string): Promise<{ url: string }>`: local URL is `/api/files/<pathname>`
  - `readStoredFile(url: string): Promise<{ data: Buffer; contentType: string }>`: accepts `/api/files/...`, `data:` and `http(s)` URLs
  - `toDataUri(file: { data: Buffer; contentType: string }): string`
  - Pathname convention: `<service>/<publisherId>/<rest>` (e.g. `ads/pub_1/creatives/<setId>/meta_feed_1080x1080.png`)
- HTTP: `GET /api/files/<service>/<publisherId>/<rest>` returns 404 unless `publisherId` matches the caller.

- [ ] **Step 1: Write the failing storage tests**

`lib/providers/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { storeFile, readStoredFile, toDataUri } from './storage'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'pt-storage-'))
  process.env.LOCAL_STORAGE_DIR = dir
  delete process.env.BLOB_READ_WRITE_TOKEN
})
afterEach(async () => {
  delete process.env.LOCAL_STORAGE_DIR
  await rm(dir, { recursive: true, force: true })
})

describe('local storage', () => {
  it('stores a file and returns a served URL', async () => {
    const { url } = await storeFile('ads/pub_1/cover.png', Buffer.from('png-bytes'), 'image/png')
    expect(url).toBe('/api/files/ads/pub_1/cover.png')
  })

  it('reads back what it stored with the right content type', async () => {
    const { url } = await storeFile('ads/pub_1/book.pdf', Buffer.from('%PDF'), 'application/pdf')
    const file = await readStoredFile(url)
    expect(file.data.toString()).toBe('%PDF')
    expect(file.contentType).toBe('application/pdf')
  })

  it('rejects path traversal', async () => {
    await expect(storeFile('ads/../../etc/passwd', Buffer.from('x'), 'text/plain')).rejects.toThrow('invalid path')
  })

  it('reads data URIs and converts files to data URIs', async () => {
    const uri = toDataUri({ data: Buffer.from('hi'), contentType: 'image/png' })
    expect(uri).toBe('data:image/png;base64,aGk=')
    const file = await readStoredFile(uri)
    expect(file.data.toString()).toBe('hi')
    expect(file.contentType).toBe('image/png')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/providers/storage.test.ts`
Expected: FAIL, `Cannot find module './storage'`

- [ ] **Step 3: Implement `lib/providers/storage.ts`**

```ts
import { put } from '@vercel/blob'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const LOCAL_URL_PREFIX = '/api/files/'

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export function localStorageRoot(): string {
  return process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), '.local-storage')
}

export function contentTypeFor(pathname: string): string {
  return CONTENT_TYPES[path.extname(pathname).toLowerCase()] ?? 'application/octet-stream'
}

export function resolveLocalPath(pathname: string): string {
  const segments = pathname.split('/')
  if (pathname.startsWith('/') || segments.some((s) => s === '..' || s === '')) {
    throw new Error('invalid path')
  }
  return path.join(localStorageRoot(), ...segments)
}

export async function storeFile(pathname: string, data: Buffer, contentType: string): Promise<{ url: string }> {
  if (isBlobConfigured()) {
    const blob = await put(pathname, data, { access: 'public', contentType })
    return { url: blob.url }
  }
  const filePath = resolveLocalPath(pathname)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, data)
  return { url: `${LOCAL_URL_PREFIX}${pathname}` }
}

export async function readStoredFile(url: string): Promise<{ data: Buffer; contentType: string }> {
  if (url.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.*)$/.exec(url)
    if (!match) throw new Error('invalid data URI')
    return { contentType: match[1], data: Buffer.from(match[2], 'base64') }
  }
  if (url.startsWith(LOCAL_URL_PREFIX)) {
    const pathname = url.slice(LOCAL_URL_PREFIX.length)
    return { data: await readFile(resolveLocalPath(pathname)), contentType: contentTypeFor(pathname) }
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`failed to fetch stored file: ${res.status}`)
  return {
    data: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  }
}

export function toDataUri(file: { data: Buffer; contentType: string }): string {
  return `data:${file.contentType};base64,${file.data.toString('base64')}`
}
```

- [ ] **Step 4: Run the storage tests**

Run: `npx vitest run lib/providers/storage.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing files-route test**

`app/api/files/[...path]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))

import { GET } from './route'
import { storeFile } from '@/lib/providers/storage'

const ctx = (segments: string[]) => ({ params: Promise.resolve({ path: segments }) })

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'pt-files-'))
  process.env.LOCAL_STORAGE_DIR = dir
  delete process.env.BLOB_READ_WRITE_TOKEN
})
afterEach(async () => {
  delete process.env.LOCAL_STORAGE_DIR
  await rm(dir, { recursive: true, force: true })
})

describe('GET /api/files/[...path]', () => {
  it("serves the caller's own file with its content type", async () => {
    await storeFile('ads/pub_1/cover.png', Buffer.from('png-bytes'), 'image/png')
    const res = await GET(new Request('http://localhost'), ctx(['ads', 'pub_1', 'cover.png']))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('png-bytes')
  })

  it("returns 404 for another publisher's file", async () => {
    await storeFile('ads/pub_2/cover.png', Buffer.from('secret'), 'image/png')
    const res = await GET(new Request('http://localhost'), ctx(['ads', 'pub_2', 'cover.png']))
    expect(res.status).toBe(404)
  })

  it('returns 404 for traversal and missing files', async () => {
    expect((await GET(new Request('http://localhost'), ctx(['ads', 'pub_1', '..', 'x']))).status).toBe(404)
    expect((await GET(new Request('http://localhost'), ctx(['ads', 'pub_1', 'nope.png']))).status).toBe(404)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run "app/api/files/[...path]/route.test.ts"`
Expected: FAIL, `Cannot find module './route'`

- [ ] **Step 7: Implement `app/api/files/[...path]/route.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { contentTypeFor, resolveLocalPath } from '@/lib/providers/storage'

const notFound = () => new Response('Not found', { status: 404 })

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params
  const publisherId = await requireCurrentPublisherId()
  if (segments.length < 3 || segments[1] !== publisherId) return notFound()

  const pathname = segments.join('/')
  let data: Buffer
  try {
    data = await readFile(resolveLocalPath(pathname))
  } catch {
    return notFound()
  }
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': contentTypeFor(pathname), 'Cache-Control': 'private, max-age=3600' },
  })
}
```

- [ ] **Step 8: Run it**

Run: `npx vitest run "app/api/files/[...path]/route.test.ts"`
Expected: PASS (3 tests)

- [ ] **Step 9: Switch the Ads routes to the storage provider**

```bash
sed -i -e "s#@/lib/blob#@/lib/providers/storage#g" -e "s#uploadToBlob#storeFile#g" \
  $(grep -rlE "@/lib/blob|uploadToBlob" app lib)
git rm lib/blob.ts lib/blob.test.ts
```

Then change the storage pathnames to the `<service>/<publisherId>/<rest>` convention:
- `app/api/ads/projects/route.ts`: `` `books/${publisherId}/${Date.now()}.pdf` `` → `` `ads/${publisherId}/${Date.now()}.pdf` ``, and the same `books/` → `ads/` for `-front.png` and `-back.png`.
- `app/api/ads/projects/[id]/route.ts`: `books/` → `ads/` in both cover pathnames.
- `app/api/ads/projects/[id]/generate/route.ts`: pass the cover as a data URI and store creatives under the publisher:

```ts
import { storeFile, readStoredFile, toDataUri } from '@/lib/providers/storage'
// ...inside POST, replacing the Promise.all block:
const coverDataUri = toDataUri(await readStoredFile(book.frontCoverUrl))
const [adCopyVariants, renderedImages] = await Promise.all([
  generateAdCopy({ title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '' }),
  renderCreativeImages({ coverImageUrl: coverDataUri, title: book.title ?? '', author: book.author ?? '' }),
])
// ...and the upload pathname:
`ads/${publisherId}/creatives/${creativeSetId}/${img.sizeKey}.png`
```

In `app/api/ads/projects/[id]/generate/route.test.ts`, the storage mock gains the two new functions:

```ts
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: 'https://blob.example/img.png' }),
  readStoredFile: vi.fn().mockResolvedValue({ data: Buffer.from('cover'), contentType: 'image/png' }),
  toDataUri: vi.fn().mockReturnValue('data:image/png;base64,Y292ZXI='),
}))
```

and it asserts the renderer gets the data URI, inside the first `it`:

```ts
expect(renderCreativeImages).toHaveBeenCalledWith(
  expect.objectContaining({ coverImageUrl: 'data:image/png;base64,Y292ZXI=' })
)
```

- [ ] **Step 10: Ignore the local store**

Append to `.gitignore`:

```
.local-storage/
```

- [ ] **Step 11: Run everything**

Run: `grep -rn "lib/blob\|uploadToBlob" app lib; npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build`
Expected: grep prints nothing; tsc exits 0; all tests pass; build lists `ƒ /api/files/[...path]`.

- [ ] **Step 12: Commit**

```bash
git add -A lib app .gitignore
git commit -m "feat: add storage provider with scoped local file store and served file route"
```

---

### Task 4: One-command local run with a separate dev database

`npm run dev` must work with no `.env.local`. It starts embedded Postgres when `DATABASE_URL` is unset (or reuses a server already on port 5432), creates `publisher_toolkit_dev`, applies migrations, then starts Next.js. Tests keep using `ads_creative_test`.

**Files:**
- Create: `scripts/embedded-db.mjs`, `scripts/embedded-db.test.ts`, `scripts/dev.mjs`
- Modify: `scripts/test-db.mjs`, `package.json` (scripts), `.env.example`, `README.md`

**Interfaces:**
- Produces:
  - `scripts/embedded-db.mjs` → `PG_PORT = 5432`, `isPortOpen(port: number, host?: string): Promise<boolean>`, `startEmbeddedDb(databases: string[]): Promise<{ stop: () => Promise<void> }>` (a no-op `stop` when the server was already running)
  - `npm run dev` → local platform on Next's chosen port; `npm run dev:next` → bare `next dev`; `npm run db:test` → test DB

- [ ] **Step 1: Write the failing port-check test**

`scripts/embedded-db.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import net from 'node:net'
import { isPortOpen } from './embedded-db.mjs'

describe('isPortOpen', () => {
  it('detects a listening port and a closed one', async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as net.AddressInfo
    expect(await isPortOpen(port)).toBe(true)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    expect(await isPortOpen(port)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run scripts/embedded-db.test.ts`
Expected: FAIL, cannot resolve `./embedded-db.mjs`

- [ ] **Step 3: Implement `scripts/embedded-db.mjs`**

```js
import { existsSync } from 'node:fs'
import net from 'node:net'
import EmbeddedPostgres from 'embedded-postgres'

export const PG_PORT = 5432
const DATA_DIR = new URL('../.pgdata', import.meta.url).pathname

export function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

// Starts (or reuses) the local Postgres on PG_PORT and makes sure each named
// database exists. Data persists in .pgdata/ (gitignored).
export async function startEmbeddedDb(databases) {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PG_PORT,
    persistent: true,
  })

  const alreadyRunning = await isPortOpen(PG_PORT)
  if (!alreadyRunning) {
    if (!existsSync(`${DATA_DIR}/PG_VERSION`)) await pg.initialise()
    await pg.start()
  }

  for (const name of databases) {
    try {
      await pg.createDatabase(name)
    } catch (err) {
      if (!String(err?.message ?? err).includes('already exists')) throw err
    }
  }

  return { stop: alreadyRunning ? async () => {} : () => pg.stop() }
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run scripts/embedded-db.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Rewrite `scripts/test-db.mjs` on top of it**

```js
// Local Postgres for integration tests. Usage: node scripts/test-db.mjs
// Stays in the foreground; stop with Ctrl-C.
import { PG_PORT, startEmbeddedDb } from './embedded-db.mjs'

const DB_NAME = 'ads_creative_test'
const { stop } = await startEmbeddedDb([DB_NAME])
console.log(`READY postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`)

const shutdown = async () => { await stop(); process.exit(0) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
await new Promise(() => {})
```

- [ ] **Step 6: Create `scripts/dev.mjs`**

```js
// One-command local run: database (if needed) → migrations → Next.js.
// Any extra args pass through to `next dev` (e.g. `npm run dev -- --port 3100`).
import { spawn, spawnSync } from 'node:child_process'
import { startEmbeddedDb } from './embedded-db.mjs'

const DEV_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/publisher_toolkit_dev'
const env = { ...process.env }
let stop = async () => {}

if (!env.DATABASE_URL) {
  env.DATABASE_URL = DEV_DATABASE_URL
  ;({ stop } = await startEmbeddedDb(['publisher_toolkit_dev']))
}

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env })
if (migrate.status !== 0) {
  await stop()
  process.exit(migrate.status ?? 1)
}

const next = spawn('npx', ['next', 'dev', ...process.argv.slice(2)], { stdio: 'inherit', env })
const shutdown = async () => {
  next.kill('SIGTERM')
  await stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
next.on('exit', async (code) => {
  await stop()
  process.exit(code ?? 0)
})
```

- [ ] **Step 7: Update `package.json` scripts**

```json
"scripts": {
  "dev": "node scripts/dev.mjs",
  "dev:next": "next dev",
  "build": "next build",
  "start": "next start",
  "db:test": "node scripts/test-db.mjs",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

Also change `"name": "ads-creative-core"` to `"name": "publisher-toolkit"`.

- [ ] **Step 8: Rewrite `.env.example` so every key is visibly optional**

```
# Everything below is OPTIONAL. With no .env.local at all, `npm run dev`
# runs the whole platform locally: embedded Postgres, a local publisher
# account, files in .local-storage/, and sample AI copy.
# Setting a value switches that capability to the real service.

# Database (unset → embedded Postgres, database publisher_toolkit_dev)
DATABASE_URL=

# Auth (unset → local publisher account)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# File storage (unset → .local-storage/)
BLOB_READ_WRITE_TOKEN=

# AI copy via Vercel AI Gateway (unset → sample copy)
AI_GATEWAY_API_KEY=
```

- [ ] **Step 9: Replace `README.md`**

````markdown
# Publisher Toolkit

A platform of tools for book publishers: Ads Creative, Trailer Video, Audio Book, and Landing Page & Website.

## Run locally

```bash
npm install
npm run dev
```

No accounts or keys needed. The dev script starts a local Postgres, applies migrations and starts Next.js. See `.env.example` for how to switch a capability to its real service.

## Tests

```bash
npm run db:test &        # local Postgres for integration tests
npx dotenv -e .env.test -- npx vitest run
npm run test:e2e         # full local browser flow
```
````

- [ ] **Step 10: Verify the no-`.env.local` run end to end**

```bash
mv .env.local /tmp/env.local.bak 2>/dev/null || true
npm run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 60); do grep -q "Ready in" /tmp/dev.log && break; sleep 1; done
PORT=$(grep -oE "localhost:[0-9]+" /tmp/dev.log | head -1 | cut -d: -f2)
curl -s -o /dev/null -w "home %{http_code}\n" http://localhost:$PORT/
curl -s -o /dev/null -w "dashboard %{http_code}\n" http://localhost:$PORT/dashboard
grep -E "migration|Migrat" /tmp/dev.log | head -3
pkill -f "scripts/dev.mjs"; pkill -f "next dev"
```

Expected: `home 200`, `dashboard 200`, and the log shows `prisma migrate deploy` applying or confirming migrations against `publisher_toolkit_dev`. Leave `.env.local` deleted, since the platform no longer needs it. (The backup is in `/tmp` in case the executor needs to inspect it.)

- [ ] **Step 11: Run the suite**

Run: `npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run`
Expected: all pass, including `scripts/embedded-db.test.ts`.

- [ ] **Step 12: Commit**

```bash
git add scripts package.json .env.example README.md
git commit -m "feat: one-command local run with embedded Postgres and a separate dev database"
```

---

### Task 5: Design system — tokens, fonts, theme, UI primitives

The visual foundation every later screen uses: a warm "publishing studio" palette in light and dark, self-hosted Inter + Fraunces, a no-flash theme toggle, toasts, and shadcn-style primitives written in-repo. The shadcn CLI isn't used because it needs network access and interactive prompts.

**Files:**
- Modify: `package.json` (deps), `app/globals.css`, `app/layout.tsx`
- Create: `components/ui/cn.ts`, `components/ui/cn.test.ts`, `components/ui/button.tsx`, `components/ui/button.test.tsx`, `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/field.tsx`, `components/platform/ThemeToggle.tsx`

**Interfaces:**
- Consumes: `isClerkConfigured` from `@/lib/providers/auth` (Task 2).
- Produces:
  - Tailwind tokens (utility names): `bg-canvas`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `border-line`, `bg-accent`/`text-accent`, `bg-accent-strong`, `bg-accent-soft`, `text-on-accent`, `text-danger`/`bg-danger`, `text-success`, `bg-tint-ads`, `bg-tint-trailer`, `bg-tint-audiobook`, `bg-tint-landing`, `rounded-card`, `shadow-card`, `shadow-lift`, `font-display`, `font-sans`; dark mode via `dark:` variant driven by `.dark` on `<html>`
  - `@/components/ui/cn` → `cn(...inputs: ClassValue[]): string`
  - `@/components/ui/button` → `Button` (props: `variant?: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size?: 'sm' | 'md' | 'lg'`, `loading?: boolean`, plus button attrs), `buttonClasses(opts?: { variant?, size?, className? }): string` for styling links
  - `@/components/ui/card` → `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
  - `@/components/ui/badge` → `Badge` (props: `tone?: 'neutral' | 'accent' | 'success' | 'warning'`)
  - `@/components/ui/field` → `Field({ label, htmlFor, hint?, error?, children })`, `Input`, `Textarea`
  - `@/components/platform/ThemeToggle` → `ThemeToggle` (client)

- [ ] **Step 1: Install dependencies**

```bash
npm install lucide-react@1.46.0 sonner@2.0.8 clsx tailwind-merge @fontsource-variable/inter @fontsource-variable/fraunces
```

- [ ] **Step 2: Write the failing `cn` and `Button` tests**

`components/ui/cn.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('drops falsy values and lets later Tailwind classes win', () => {
    expect(cn('px-2 py-1', false && 'hidden', undefined, 'px-4')).toBe('py-1 px-4')
  })
})
```

`components/ui/button.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button, buttonClasses } from './button'

describe('Button', () => {
  it('renders the primary style by default', () => {
    const html = renderToStaticMarkup(<Button>Go</Button>)
    expect(html).toContain('bg-accent')
    expect(html).toContain('>Go<')
  })

  it('is disabled and busy while loading', () => {
    const html = renderToStaticMarkup(<Button loading>Saving</Button>)
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
  })

  it('exposes the same classes for links', () => {
    expect(buttonClasses({ variant: 'secondary' })).toContain('border-line')
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run components/ui`
Expected: FAIL, cannot find `./cn` and `./button`

- [ ] **Step 4: Implement `cn` and `Button`**

`components/ui/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

`components/ui/button.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

const VARIANTS = {
  primary: 'bg-accent text-on-accent shadow-card hover:bg-accent-strong',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
} as const

const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

export function buttonClasses(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  const { variant = 'primary', size = 'md', className } = opts
  return cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className
  )
}

export function Button({
  variant,
  size,
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/ui`
Expected: PASS (4 tests)

- [ ] **Step 6: Create `Card`, `Badge` and `Field`**

`components/ui/card.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from './cn'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-card border border-line bg-surface shadow-card', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6 pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('font-display text-xl font-semibold tracking-tight text-ink', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-ink-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-3', className)} {...props} />
}
```

`components/ui/badge.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from './cn'

const TONES = {
  neutral: 'bg-surface-2 text-ink-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
} as const

export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone], className)}
      {...props}
    />
  )
}
```

`components/ui/field.tsx`:

```tsx
import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

const control =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted/70 transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 aria-[invalid=true]:border-danger'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">{error}</p>
      ) : (
        hint && <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Replace `app/globals.css` with the design tokens**

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Fraunces Variable", ui-serif, Georgia, serif;

  --color-canvas: oklch(0.985 0.006 80);
  --color-surface: oklch(1 0 0);
  --color-surface-2: oklch(0.965 0.008 80);
  --color-ink: oklch(0.22 0.02 60);
  --color-ink-muted: oklch(0.48 0.02 60);
  --color-line: oklch(0.91 0.01 80);
  --color-accent: oklch(0.52 0.13 40);
  --color-accent-strong: oklch(0.45 0.13 40);
  --color-accent-soft: oklch(0.95 0.03 45);
  --color-on-accent: oklch(0.99 0 0);
  --color-danger: oklch(0.55 0.2 27);
  --color-success: oklch(0.52 0.11 150);

  --color-tint-ads: oklch(0.93 0.05 45);
  --color-tint-trailer: oklch(0.93 0.04 295);
  --color-tint-audiobook: oklch(0.93 0.05 160);
  --color-tint-landing: oklch(0.93 0.045 235);

  --radius-card: 1.25rem;
  --shadow-card: 0 1px 2px oklch(0.2 0.02 60 / 0.05), 0 8px 24px -12px oklch(0.2 0.02 60 / 0.16);
  --shadow-lift: 0 2px 4px oklch(0.2 0.02 60 / 0.08), 0 20px 44px -18px oklch(0.2 0.02 60 / 0.3);
}

.dark {
  --color-canvas: oklch(0.17 0.01 60);
  --color-surface: oklch(0.21 0.012 60);
  --color-surface-2: oklch(0.255 0.012 60);
  --color-ink: oklch(0.95 0.008 80);
  --color-ink-muted: oklch(0.73 0.015 70);
  --color-line: oklch(0.32 0.012 60);
  --color-accent: oklch(0.74 0.12 48);
  --color-accent-strong: oklch(0.8 0.11 52);
  --color-accent-soft: oklch(0.3 0.05 45);
  --color-on-accent: oklch(0.18 0.02 60);
  --color-danger: oklch(0.68 0.18 27);
  --color-success: oklch(0.72 0.12 150);
  --color-tint-ads: oklch(0.32 0.06 45);
  --color-tint-trailer: oklch(0.32 0.05 295);
  --color-tint-audiobook: oklch(0.32 0.06 160);
  --color-tint-landing: oklch(0.32 0.05 235);
}

@layer base {
  html {
    color-scheme: light;
  }
  html.dark {
    color-scheme: dark;
  }
  body {
    @apply bg-canvas font-sans text-ink antialiased;
  }
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **Step 8: Create `components/platform/ThemeToggle.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
    setDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  )
}
```

- [ ] **Step 9: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'sonner'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import { isClerkConfigured } from '@/lib/providers/auth'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Publisher Toolkit', template: '%s · Publisher Toolkit' },
  description: 'Tools for book publishers: ad creatives, trailers, audiobooks and landing pages.',
}

// Runs before paint so the saved or system theme never flashes.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const document = (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )

  // Local mode: skip ClerkProvider so the browser never loads Clerk JS.
  return isClerkConfigured() ? <ClerkProvider>{document}</ClerkProvider> : document
}
```

- [ ] **Step 10: Verify types, tests and build**

Run: `npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build`
Expected: all green. Then check the emitted CSS carries the tokens: `grep -l "color-tint-ads" .next/static/chunks/*.css` prints at least one file.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json app/globals.css app/layout.tsx components
git commit -m "feat: add design system tokens, self-hosted fonts, theme toggle and UI primitives"
```

---

### Task 6: Platform shell and service hub

The ilovepdf-style front door: a sticky top bar (logo, service switcher, Local mode badge, theme toggle, account), a hub of four service cards, and designed "coming soon" pages for the three services built in later plans.

**Files:**
- Create: `lib/services/registry.ts`, `lib/services/registry.test.ts`
- Create: `components/platform/ServiceIcon.tsx`, `components/platform/ServiceCard.tsx`, `components/platform/ComingSoon.tsx`, `components/platform/TopBar.tsx`, `components/platform/ServiceSwitcher.tsx`, `components/platform/LocalModeBadge.tsx`, `components/platform/AccountChip.tsx`
- Create: `app/(platform)/layout.tsx`, `app/(platform)/page.tsx`, `app/(platform)/trailer/page.tsx`, `app/(platform)/audiobook/page.tsx`, `app/(platform)/landing/page.tsx`
- Delete: `app/page.tsx` (the hub now serves `/`)

**Interfaces:**
- Consumes: `getCapabilityStatus` (Task 2), `isClerkConfigured` (Task 2), `Card*`, `Badge`, `buttonClasses`, `cn`, `ThemeToggle` (Task 5).
- Produces:
  - `@/lib/services/registry` → `type ServiceKey = 'ads' | 'trailer' | 'audiobook' | 'landing'`, `type ServiceIconName = 'megaphone' | 'clapperboard' | 'headphones' | 'layout-template'`, `interface ServiceDefinition { key: ServiceKey; name: string; tagline: string; description: string; href: string; icon: ServiceIconName; tintClass: string; availability: 'live' | 'coming-soon'; highlights: string[] }`, `SERVICES: ServiceDefinition[]`, `getService(key: ServiceKey): ServiceDefinition`
  - `@/components/platform/ServiceIcon` → `ServiceIcon({ name, className? })`
  - `@/components/platform/ComingSoon` → `ComingSoon({ service })`
  - `app/(platform)/layout.tsx`: every platform page renders inside `<TopBar/>` + `<main>`

- [ ] **Step 1: Write the failing registry test**

`lib/services/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SERVICES, getService } from './registry'

describe('service registry', () => {
  it('lists the four services with unique keys and matching hrefs', () => {
    expect(SERVICES.map((s) => s.key)).toEqual(['ads', 'trailer', 'audiobook', 'landing'])
    for (const s of SERVICES) {
      expect(s.href).toBe(`/${s.key}`)
      expect(s.tintClass).toBe(`bg-tint-${s.key}`)
      expect(s.highlights.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('marks only Ads Creative as live for now', () => {
    expect(SERVICES.filter((s) => s.availability === 'live').map((s) => s.key)).toEqual(['ads'])
  })

  it('looks services up by key', () => {
    expect(getService('trailer').name).toBe('Trailer Video')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/services/registry.test.ts`
Expected: FAIL, `Cannot find module './registry'`

- [ ] **Step 3: Implement `lib/services/registry.ts`**

```ts
export type ServiceKey = 'ads' | 'trailer' | 'audiobook' | 'landing'
export type ServiceIconName = 'megaphone' | 'clapperboard' | 'headphones' | 'layout-template'

export interface ServiceDefinition {
  key: ServiceKey
  name: string
  tagline: string
  description: string
  href: string
  icon: ServiceIconName
  tintClass: string
  availability: 'live' | 'coming-soon'
  highlights: string[]
}

export const SERVICES: ServiceDefinition[] = [
  {
    key: 'ads',
    name: 'Ads Creative',
    tagline: 'Scroll-stopping ads from your book in minutes.',
    description:
      'Upload your book and get ready-to-run ad images and copy for Meta, Google and Amazon, sized perfectly for every placement.',
    href: '/ads',
    icon: 'megaphone',
    tintClass: 'bg-tint-ads',
    availability: 'live',
    highlights: ['Cover and blurb pulled from your PDF', 'AI-written copy per platform', 'Every ad size, ready to download or push'],
  },
  {
    key: 'trailer',
    name: 'Trailer Video',
    tagline: 'A cinematic trailer that sells the story.',
    description: 'Turn your cover and pages into a short, shareable book trailer for Reels, Shorts and YouTube.',
    href: '/trailer',
    icon: 'clapperboard',
    tintClass: 'bg-tint-trailer',
    availability: 'coming-soon',
    highlights: ['15, 30 or 60 second cuts', 'Vertical, square and widescreen', 'Mood-matched music'],
  },
  {
    key: 'audiobook',
    name: 'Audio Book',
    tagline: 'Your book, beautifully narrated.',
    description: 'Create a chapter-by-chapter audiobook from your manuscript, in a voice modeled on your reference clip.',
    href: '/audiobook',
    icon: 'headphones',
    tintClass: 'bg-tint-audiobook',
    availability: 'coming-soon',
    highlights: ['Automatic chapter detection', 'Narration from a reference voice', 'Download per chapter or complete'],
  },
  {
    key: 'landing',
    name: 'Landing Page & Website',
    tagline: 'A home on the web for your book.',
    description: 'Generate a polished landing page for your book and author profile, ready to preview, export or publish.',
    href: '/landing',
    icon: 'layout-template',
    tintClass: 'bg-tint-landing',
    availability: 'coming-soon',
    highlights: ['Designed templates', 'Live desktop and mobile preview', 'Export clean HTML'],
  },
]

export function getService(key: ServiceKey): ServiceDefinition {
  return SERVICES.find((s) => s.key === key)!
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run lib/services/registry.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Create the shared service visuals**

`components/platform/ServiceIcon.tsx`:

```tsx
import { Clapperboard, Headphones, LayoutTemplate, Megaphone, type LucideIcon } from 'lucide-react'
import type { ServiceIconName } from '@/lib/services/registry'

const ICONS: Record<ServiceIconName, LucideIcon> = {
  megaphone: Megaphone,
  clapperboard: Clapperboard,
  headphones: Headphones,
  'layout-template': LayoutTemplate,
}

export function ServiceIcon({ name, className }: { name: ServiceIconName; className?: string }) {
  const Icon = ICONS[name]
  return <Icon className={className} aria-hidden />
}
```

`components/platform/ServiceCard.tsx`:

```tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ServiceDefinition } from '@/lib/services/registry'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/components/ui/cn'
import { ServiceIcon } from './ServiceIcon'

export function ServiceCard({ service }: { service: ServiceDefinition }) {
  const live = service.availability === 'live'
  return (
    <Link
      href={service.href}
      className="group relative flex flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-7"
    >
      <div className="flex items-start justify-between">
        <span className={cn('grid size-12 place-items-center rounded-2xl text-ink', service.tintClass)}>
          <ServiceIcon name={service.icon} className="size-6" />
        </span>
        {live ? <Badge tone="success">Available</Badge> : <Badge>Coming soon</Badge>}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{service.name}</h2>
        <p className="text-ink-muted">{service.tagline}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        {live ? 'Open tool' : 'Learn more'}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}
```

`components/platform/ComingSoon.tsx`:

```tsx
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import type { ServiceDefinition } from '@/lib/services/registry'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { ServiceIcon } from './ServiceIcon'

export function ComingSoon({ service }: { service: ServiceDefinition }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center sm:py-24">
      <span className={cn('grid size-20 place-items-center rounded-3xl text-ink shadow-card', service.tintClass)}>
        <ServiceIcon name={service.icon} className="size-9" />
      </span>
      <Badge className="mt-6">Coming soon</Badge>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{service.name}</h1>
      <p className="mt-4 text-lg text-ink-muted">{service.description}</p>
      <ul className="mt-8 flex flex-col gap-3 text-left">
        {service.highlights.map((h) => (
          <li key={h} className="flex items-center gap-3">
            <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent">
              <Check className="size-3.5" aria-hidden />
            </span>
            {h}
          </li>
        ))}
      </ul>
      <Link href="/" className={buttonClasses({ variant: 'secondary', className: 'mt-10' })}>
        <ArrowLeft className="size-4" aria-hidden /> Back to all tools
      </Link>
    </div>
  )
}
```

- [ ] **Step 6: Create the top-bar parts**

`components/platform/ServiceSwitcher.tsx`:

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import type { ServiceDefinition } from '@/lib/services/registry'
import { cn } from '@/components/ui/cn'
import { ServiceIcon } from './ServiceIcon'

export function ServiceSwitcher({ services }: { services: ServiceDefinition[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = services.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => setOpen(false), [pathname])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-2"
      >
        {current ? <ServiceIcon name={current.icon} className="size-4 text-accent" /> : <LayoutGrid className="size-4 text-accent" aria-hidden />}
        {current?.name ?? 'All tools'}
        <ChevronDown className={cn('size-4 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-11 z-50 w-72 rounded-2xl border border-line bg-surface p-2 shadow-lift">
          <Link role="menuitem" href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            <LayoutGrid className="size-4 text-ink-muted" aria-hidden /> All tools
          </Link>
          <div className="my-1 h-px bg-line" />
          {services.map((s) => (
            <Link
              key={s.key}
              role="menuitem"
              href={s.href}
              className={cn('flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2', current?.key === s.key && 'bg-surface-2')}
            >
              <span className={cn('grid size-8 place-items-center rounded-lg', s.tintClass)}>
                <ServiceIcon name={s.icon} className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium">{s.name}</span>
                {s.availability === 'coming-soon' && <span className="text-xs text-ink-muted">Coming soon</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

`components/platform/LocalModeBadge.tsx`:

```tsx
import { FlaskConical } from 'lucide-react'
import { getCapabilityStatus } from '@/lib/providers/status'
import { Badge } from '@/components/ui/badge'

const LABELS = { auth: 'Sign-in', storage: 'File storage', ai: 'AI copy', adsPush: 'Ad account push' } as const

export function LocalModeBadge() {
  const status = getCapabilityStatus()
  const simulated = (Object.keys(LABELS) as (keyof typeof LABELS)[]).filter((k) => status[k] === 'local')
  if (simulated.length === 0) return null
  const detail = `Running locally. Simulated: ${simulated.map((k) => LABELS[k]).join(', ')}.`
  return (
    <Badge tone="warning" title={detail} className="hidden sm:inline-flex">
      <FlaskConical className="size-3.5" aria-hidden />
      Local mode
      <span className="sr-only">{detail}</span>
    </Badge>
  )
}
```

`components/platform/AccountChip.tsx`:

```tsx
import { UserButton } from '@clerk/nextjs'
import { isClerkConfigured } from '@/lib/providers/auth'

export function AccountChip() {
  if (isClerkConfigured()) return <UserButton />
  return (
    <div className="flex items-center gap-2" aria-label="Signed in as Local publisher">
      <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-on-accent">LP</span>
      <span className="hidden text-sm font-medium md:inline">Local publisher</span>
    </div>
  )
}
```

`components/platform/TopBar.tsx`:

```tsx
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { SERVICES } from '@/lib/services/registry'
import { ServiceSwitcher } from './ServiceSwitcher'
import { LocalModeBadge } from './LocalModeBadge'
import { ThemeToggle } from './ThemeToggle'
import { AccountChip } from './AccountChip'

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent shadow-card">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <span className="hidden font-display text-lg font-semibold tracking-tight sm:inline">Publisher Toolkit</span>
        </Link>
        <div className="mx-2 hidden h-6 w-px bg-line sm:block" />
        <ServiceSwitcher services={SERVICES} />
        <div className="ml-auto flex items-center gap-2">
          <LocalModeBadge />
          <ThemeToggle />
          <AccountChip />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 7: Create the platform layout, hub and coming-soon routes**

`app/(platform)/layout.tsx`:

```tsx
import { TopBar } from '@/components/platform/TopBar'

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
```

`app/(platform)/page.tsx`:

```tsx
import { SERVICES } from '@/lib/services/registry'
import { ServiceCard } from '@/components/platform/ServiceCard'

export default function HubPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Publisher Toolkit</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Every tool your book needs to find its readers.
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          Pick a tool to get started. Each one keeps its own projects, so you can focus on one thing at a time.
        </p>
      </header>
      <section aria-label="Tools" className="mt-10 grid gap-5 sm:grid-cols-2">
        {SERVICES.map((service) => (
          <ServiceCard key={service.key} service={service} />
        ))}
      </section>
    </div>
  )
}
```

`app/(platform)/trailer/page.tsx` (repeat for `audiobook` and `landing` with their own key and metadata title):

```tsx
import type { Metadata } from 'next'
import { getService } from '@/lib/services/registry'
import { ComingSoon } from '@/components/platform/ComingSoon'

export const metadata: Metadata = { title: 'Trailer Video' }

export default function TrailerPage() {
  return <ComingSoon service={getService('trailer')} />
}
```

`app/(platform)/audiobook/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { getService } from '@/lib/services/registry'
import { ComingSoon } from '@/components/platform/ComingSoon'

export const metadata: Metadata = { title: 'Audio Book' }

export default function AudiobookPage() {
  return <ComingSoon service={getService('audiobook')} />
}
```

`app/(platform)/landing/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { getService } from '@/lib/services/registry'
import { ComingSoon } from '@/components/platform/ComingSoon'

export const metadata: Metadata = { title: 'Landing Page & Website' }

export default function LandingPage() {
  return <ComingSoon service={getService('landing')} />
}
```

```bash
git rm app/page.tsx
```

- [ ] **Step 8: Verify in the running app**

```bash
npx tsc --noEmit && npm run build
npm run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 60); do grep -q "Ready in" /tmp/dev.log && break; sleep 1; done
PORT=$(grep -oE "localhost:[0-9]+" /tmp/dev.log | head -1 | cut -d: -f2)
curl -s http://localhost:$PORT/ | grep -oE "Ads Creative|Trailer Video|Audio Book|Landing Page &amp; Website|Coming soon|Local mode" | sort -u
curl -s -o /dev/null -w "trailer %{http_code}\n" http://localhost:$PORT/trailer
pkill -f "scripts/dev.mjs"; pkill -f "next dev"
```

Expected: build succeeds; the hub output lists all four names plus `Coming soon` and `Local mode`; `trailer 200`.

- [ ] **Step 9: Commit**

```bash
git add -A app components lib/services/registry.ts lib/services/registry.test.ts
git commit -m "feat: add platform shell, service hub and coming-soon pages"
```

---

### Task 7: Ads project configuration — schema, options, JSON update API

Gives an Ads project the state behind the Configure step and resume-where-you-left-off: status, chosen platforms, copy tone and template. It also lets the upload review step save edited title/author/blurb.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_ads_project_config/migration.sql` (generated)
- Create: `lib/services/ads/options.ts`, `lib/services/ads/options.test.ts`
- Modify: `app/api/ads/projects/[id]/route.ts`, `app/api/ads/projects/[id]/route.test.ts`

**Interfaces:**
- Consumes: `AdPlatform` (Task 1), `getBookForPublisher` (Task 1), `requireCurrentPublisherId` (Task 2), `storeFile` (Task 3).
- Produces:
  - `Book` gains: `status String @default("uploaded")`, `platforms String[] @default(["META","GOOGLE","AMAZON"])`, `copyTone String @default("literary")`, `templateKey String @default("classic")`, `updatedAt DateTime @default(now()) @updatedAt`
  - `@/lib/services/ads/options` →
    - `PLATFORMS: { key: AdPlatform; label: string; description: string }[]`
    - `TONES: readonly { key: CopyTone; label: string; description: string }[]`, `type CopyTone = 'literary' | 'punchy' | 'bold'`
    - `TEMPLATES: readonly { key: TemplateKey; label: string; description: string; palette: { background: string; ink: string; accent: string } }[]`, `type TemplateKey = 'classic' | 'bold' | 'minimal'`, `getTemplate(key: string): (typeof TEMPLATES)[number]` (unknown key → classic)
    - `type ProjectStatus = 'uploaded' | 'configured' | 'generated'`
    - `projectUpdateSchema` (zod): all optional `title`, `author`, `blurb`, `platforms`, `copyTone`, `templateKey`; at least one key
  - HTTP: `PATCH /api/ads/projects/:id` with `Content-Type: application/json` → `{ id }` 200. When the body carries all three of `platforms`, `copyTone`, `templateKey`, status becomes `configured`. Validation failure → 400 `{ error: string }`. Multipart cover upload keeps working as before.

- [ ] **Step 1: Add the fields to `Book` in `prisma/schema.prisma`**

```prisma
model Book {
  id            String        @id @default(cuid())
  publisherId   String
  title         String?
  author        String?
  blurb         String?
  pdfUrl        String
  frontCoverUrl String?
  backCoverUrl  String?
  status        String        @default("uploaded")
  platforms     String[]      @default(["META", "GOOGLE", "AMAZON"])
  copyTone      String        @default("literary")
  templateKey   String        @default("classic")
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @default(now()) @updatedAt
  creativeSets  CreativeSet[]

  @@index([publisherId])
}
```

- [ ] **Step 2: Generate and apply the migration against the test database**

Run: `npx dotenv -e .env.test -- npx prisma migrate dev --name ads_project_config`
Expected: a new `prisma/migrations/*_ads_project_config/migration.sql` with `ALTER TABLE "Book" ADD COLUMN` for the five columns, and "Generated Prisma Client".

- [ ] **Step 3: Write the failing options test**

`lib/services/ads/options.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PLATFORMS, TONES, TEMPLATES, getTemplate, projectUpdateSchema } from './options'

describe('ads options', () => {
  it('offers the three platforms, tones and templates', () => {
    expect(PLATFORMS.map((p) => p.key)).toEqual(['META', 'GOOGLE', 'AMAZON'])
    expect(TONES.map((t) => t.key)).toEqual(['literary', 'punchy', 'bold'])
    expect(TEMPLATES.map((t) => t.key)).toEqual(['classic', 'bold', 'minimal'])
  })

  it('falls back to the classic template for unknown keys', () => {
    expect(getTemplate('nope').key).toBe('classic')
  })
})

describe('projectUpdateSchema', () => {
  it('accepts a details-only update', () => {
    expect(projectUpdateSchema.safeParse({ title: 'New title' }).success).toBe(true)
  })

  it('accepts a full config update', () => {
    const r = projectUpdateSchema.safeParse({ platforms: ['META'], copyTone: 'bold', templateKey: 'minimal' })
    expect(r.success).toBe(true)
  })

  it('rejects an empty platform list, unknown tone, and an empty body', () => {
    expect(projectUpdateSchema.safeParse({ platforms: [] }).success).toBe(false)
    expect(projectUpdateSchema.safeParse({ copyTone: 'sarcastic' }).success).toBe(false)
    expect(projectUpdateSchema.safeParse({}).success).toBe(false)
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run lib/services/ads/options.test.ts`
Expected: FAIL, `Cannot find module './options'`

- [ ] **Step 5: Implement `lib/services/ads/options.ts`**

```ts
import { z } from 'zod'
import type { AdPlatform } from './copy'

export const PLATFORMS: { key: AdPlatform; label: string; description: string }[] = [
  { key: 'META', label: 'Meta', description: 'Facebook & Instagram feed and stories' },
  { key: 'GOOGLE', label: 'Google', description: 'Display network banners' },
  { key: 'AMAZON', label: 'Amazon', description: 'Sponsored display, downloaded for manual upload' },
]

export const TONES = [
  { key: 'literary', label: 'Literary', description: 'Evocative and story-first' },
  { key: 'punchy', label: 'Punchy', description: 'Short, urgent, scroll-stopping' },
  { key: 'bold', label: 'Bold', description: 'Big claims, big energy' },
] as const
export type CopyTone = (typeof TONES)[number]['key']

export const TEMPLATES = [
  {
    key: 'classic',
    label: 'Classic',
    description: 'Dark and elegant, cover-forward',
    palette: { background: '#1c1917', ink: '#fafaf9', accent: '#f59e0b' },
  },
  {
    key: 'bold',
    label: 'Bold',
    description: 'Saturated color that pops in a feed',
    palette: { background: '#9f1239', ink: '#ffffff', accent: '#fde68a' },
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Light, quiet, lots of breathing room',
    palette: { background: '#fafaf9', ink: '#1c1917', accent: '#78716c' },
  },
] as const
export type TemplateKey = (typeof TEMPLATES)[number]['key']

export function getTemplate(key: string): (typeof TEMPLATES)[number] {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0]
}

export type ProjectStatus = 'uploaded' | 'configured' | 'generated'

export const projectUpdateSchema = z
  .object({
    title: z.string().trim().max(200),
    author: z.string().trim().max(200),
    blurb: z.string().trim().max(2000),
    platforms: z.array(z.enum(['META', 'GOOGLE', 'AMAZON'])).min(1, 'Choose at least one platform'),
    copyTone: z.enum(['literary', 'punchy', 'bold']),
    templateKey: z.enum(['classic', 'bold', 'minimal']),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')
```

- [ ] **Step 6: Run it**

Run: `npx vitest run lib/services/ads/options.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Write the failing JSON-update route tests**

Append inside the `describe` in `app/api/ads/projects/[id]/route.test.ts`:

```ts
function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/ads/projects/book_1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

it('updates edited book details from JSON', async () => {
  const res = await PATCH(jsonRequest({ title: 'Better Title', blurb: 'New blurb' }), ctx('book_1'))
  expect(res.status).toBe(200)
  expect(prisma.book.update).toHaveBeenCalledWith({
    where: { id: 'book_1' },
    data: { title: 'Better Title', blurb: 'New blurb' },
  })
})

it('saves a full configuration and marks the project configured', async () => {
  const res = await PATCH(jsonRequest({ platforms: ['META', 'GOOGLE'], copyTone: 'punchy', templateKey: 'bold' }), ctx('book_1'))
  expect(res.status).toBe(200)
  expect(prisma.book.update).toHaveBeenCalledWith({
    where: { id: 'book_1' },
    data: { platforms: ['META', 'GOOGLE'], copyTone: 'punchy', templateKey: 'bold', status: 'configured' },
  })
})

it('rejects an invalid configuration with a readable error', async () => {
  const res = await PATCH(jsonRequest({ platforms: [] }), ctx('book_1'))
  expect(res.status).toBe(400)
  expect((await res.json()).error).toBe('Choose at least one platform')
  expect(prisma.book.update).not.toHaveBeenCalled()
})

it('rejects malformed JSON', async () => {
  const req = new Request('http://localhost/api/ads/projects/book_1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  })
  expect((await PATCH(req, ctx('book_1'))).status).toBe(400)
})
```

- [ ] **Step 8: Run them to verify they fail**

Run: `npx vitest run "app/api/ads/projects/[id]/route.test.ts"`
Expected: the four new tests FAIL (the route tries to read the JSON body as form data); the existing cover tests still PASS.

- [ ] **Step 9: Add the JSON branch to `app/api/ads/projects/[id]/route.ts`**

Add the import and put this at the top of `PATCH`, right after the `if (!book)` 404 check. The existing multipart cover code below it stays unchanged:

```ts
import { projectUpdateSchema } from '@/lib/services/ads/options'

// ...inside PATCH, after the 404 check:
if (request.headers.get('content-type')?.includes('application/json')) {
  const raw = await request.json().catch(() => null)
  const parsed = projectUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update' }, { status: 400 })
  }
  const update = parsed.data
  const completesConfig = Boolean(update.platforms && update.copyTone && update.templateKey)
  const updated = await prisma.book.update({
    where: { id: book.id },
    data: completesConfig ? { ...update, status: 'configured' } : update,
  })
  return NextResponse.json({ id: updated.id }, { status: 200 })
}
```

- [ ] **Step 10: Run the route tests, then everything**

Run: `npx vitest run "app/api/ads/projects/[id]/route.test.ts" && npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run`
Expected: route file PASS (10 tests); the whole suite passes.

- [ ] **Step 11: Commit**

```bash
git add prisma lib/services/ads/options.ts lib/services/ads/options.test.ts "app/api/ads/projects/[id]"
git commit -m "feat: add Ads project configuration fields, options and JSON update API"
```

---

### Task 8: Generation honors the project configuration

Generation now uses the chosen platforms, tone and template. It always writes one editable copy row per selected platform, blank when AI copy failed. It marks the project `generated`, and turns failures into a readable JSON error instead of a crash.

**Files:**
- Modify: `lib/services/ads/copy.ts`, `lib/services/ads/copy.test.ts`
- Modify: `lib/services/ads/render.tsx`, `lib/services/ads/render.test.ts`, `lib/services/ads/CreativeTemplate.tsx`
- Modify: `app/api/ads/projects/[id]/generate/route.ts`, `app/api/ads/projects/[id]/generate/route.test.ts`

**Interfaces:**
- Consumes: `CopyTone`, `TemplateKey`, `getTemplate` (Task 7), `sampleAdCopy` (Task 2), `readStoredFile`/`toDataUri`/`storeFile` (Task 3).
- Produces:
  - `generateAdCopy(book: { title: string; author: string; blurb: string }, options?: { tone?: CopyTone; platforms?: AdPlatform[] }): Promise<AdCopyResult[]>`: returns only the requested platforms; `[]` after a failed retry
  - `renderCreativeImages(input: { coverImageUrl: string; title: string; author: string; templateKey?: string; platforms?: AdPlatform[] }): Promise<RenderedCreativeImage[]>`: only sizes for the requested platforms (all when omitted or empty)
  - `CreativeTemplate` props gain `palette: { background: string; ink: string; accent: string }`
  - `POST /api/ads/projects/:id/generate` → 201 `{ creativeSetId }`; 404 wrong tenant; 400 `{ error }` no cover; 500 `{ error: string }` on generation failure (no rows written, status unchanged). On success the book's `status` becomes `generated`.

- [ ] **Step 1: Write the failing copy-options tests**

Add to `lib/services/ads/copy.test.ts` (inside the `describe`, where `AI_GATEWAY_API_KEY` is set by `beforeEach`):

```ts
it('includes the tone in the prompt and keeps only requested platforms', async () => {
  vi.mocked(generateText).mockResolvedValue({
    output: {
      variants: [
        { platform: 'META', headline: 'H', primaryText: 'P', description: 'D' },
        { platform: 'GOOGLE', headline: 'H2', primaryText: 'P2', description: 'D2' },
        { platform: 'AMAZON', headline: 'H3', primaryText: 'P3', description: 'D3' },
      ],
    },
  } as any)

  const result = await generateAdCopy(book, { tone: 'punchy', platforms: ['GOOGLE'] })

  expect(result.map((r) => r.platform)).toEqual(['GOOGLE'])
  expect(vi.mocked(generateText).mock.calls[0][0].prompt).toContain('Tone: punchy')
})

it('filters local sample copy to the requested platforms too', async () => {
  delete process.env.AI_GATEWAY_API_KEY
  const result = await generateAdCopy(book, { tone: 'bold', platforms: ['META', 'AMAZON'] })
  expect(result.map((r) => r.platform)).toEqual(['META', 'AMAZON'])
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/services/ads/copy.test.ts`
Expected: the two new tests FAIL (all three platforms come back and the prompt has no tone).

- [ ] **Step 3: Update `lib/services/ads/copy.ts`**

```ts
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { isAiConfigured } from '@/lib/providers/ai'
import { sampleAdCopy } from './sampleCopy'
import type { CopyTone } from './options'

export type AdPlatform = 'META' | 'GOOGLE' | 'AMAZON'

export interface AdCopyResult {
  platform: AdPlatform
  headline: string
  primaryText: string
  description: string
}

type BookInput = { title: string; author: string; blurb: string }

const adCopySchema = z.object({
  variants: z.array(
    z.object({
      platform: z.enum(['META', 'GOOGLE', 'AMAZON']),
      headline: z.string(),
      primaryText: z.string(),
      description: z.string(),
    })
  ),
})

async function attemptGeneration(book: BookInput, tone: CopyTone) {
  const { output } = await generateText({
    model: 'anthropic/claude-sonnet-5',
    output: Output.object({ schema: adCopySchema }),
    prompt: `Write ad copy for a book, one variant each for Meta, Google, and Amazon ads.
Book title: ${book.title}
Author: ${book.author}
Blurb: ${book.blurb}
Tone: ${tone}
Meta: casual, hook-driven headline (<=40 chars), primary text (<=125 chars).
Google: benefit-driven headline (<=30 chars), description (<=90 chars).
Amazon: straightforward, title/author forward.`,
  })
  return output.variants
}

export async function generateAdCopy(
  book: BookInput,
  options: { tone?: CopyTone; platforms?: AdPlatform[] } = {}
): Promise<AdCopyResult[]> {
  const tone = options.tone ?? 'literary'
  const wanted = (variants: AdCopyResult[]) =>
    options.platforms?.length ? variants.filter((v) => options.platforms!.includes(v.platform)) : variants

  if (!isAiConfigured()) return wanted(sampleAdCopy(book, tone))
  try {
    return wanted(await attemptGeneration(book, tone))
  } catch {
    try {
      return wanted(await attemptGeneration(book, tone))
    } catch {
      return []
    }
  }
}
```

- [ ] **Step 4: Run the copy tests**

Run: `npx vitest run lib/services/ads/copy.test.ts`
Expected: PASS (all, including the retry-twice-then-`[]` test)

- [ ] **Step 5: Write the failing render filter test**

Add to `lib/services/ads/render.test.ts`:

```ts
it('renders only the sizes for the requested platforms, with the chosen template', async () => {
  const images = await renderCreativeImages({
    coverImageUrl: 'https://example.com/cover.png',
    title: 'The Lazy Developer',
    author: 'Jane Coder',
    templateKey: 'minimal',
    platforms: ['META'],
  })
  expect(images.map((i) => i.sizeKey)).toEqual(['meta_feed_1080x1080', 'meta_story_1080x1920'])
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run lib/services/ads/render.test.ts`
Expected: the new test FAILS (5 sizes rendered).

- [ ] **Step 7: Update `render.tsx` and `CreativeTemplate.tsx`**

`lib/services/ads/render.tsx`:

```tsx
import { ImageResponse } from 'next/og'
import { CREATIVE_SIZES } from './sizes'
import { CreativeTemplate } from './CreativeTemplate'
import { getTemplate } from './options'
import type { AdPlatform } from './copy'

export interface RenderedCreativeImage {
  sizeKey: string
  platform: AdPlatform
  width: number
  height: number
  pngBuffer: Buffer
}

export async function renderCreativeImages(input: {
  coverImageUrl: string
  title: string
  author: string
  templateKey?: string
  platforms?: AdPlatform[]
}): Promise<RenderedCreativeImage[]> {
  const { palette } = getTemplate(input.templateKey ?? 'classic')
  const sizes = input.platforms?.length
    ? CREATIVE_SIZES.filter((s) => input.platforms!.includes(s.platform))
    : CREATIVE_SIZES

  const results: RenderedCreativeImage[] = []
  for (const spec of sizes) {
    const response = new ImageResponse(
      (
        <CreativeTemplate
          coverImageUrl={input.coverImageUrl}
          title={input.title}
          author={input.author}
          width={spec.width}
          height={spec.height}
          palette={palette}
        />
      ),
      { width: spec.width, height: spec.height }
    )
    results.push({
      sizeKey: spec.key,
      platform: spec.platform,
      width: spec.width,
      height: spec.height,
      pngBuffer: Buffer.from(await response.arrayBuffer()),
    })
  }
  return results
}
```

`lib/services/ads/CreativeTemplate.tsx`:

```tsx
export function CreativeTemplate({
  coverImageUrl,
  title,
  author,
  width,
  height,
  palette,
}: {
  coverImageUrl: string
  title: string
  author: string
  width: number
  height: number
  palette: { background: string; ink: string; accent: string }
}) {
  // Row layout only for genuinely wide banners (e.g. 728x90); 300x250 stacks.
  const isBanner = width / height >= 2
  const scale = Math.min(width, height) / 1080
  const coverSize = isBanner ? height - 24 : Math.min(width, height) * 0.58
  const titleSize = isBanner ? Math.max(14, height * 0.22) : Math.max(16, 64 * scale)
  const authorSize = isBanner ? Math.max(11, height * 0.15) : Math.max(12, 34 * scale)

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: isBanner ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.background,
        color: palette.ink,
        fontFamily: 'serif',
        padding: isBanner ? 12 : Math.max(12, 48 * scale),
        gap: isBanner ? 14 : Math.max(8, 36 * scale),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverImageUrl}
        width={coverSize}
        height={coverSize}
        style={{ objectFit: 'cover', borderRadius: Math.max(4, 16 * scale), boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isBanner ? 'flex-start' : 'center', gap: 6 }}>
        <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.1, textAlign: isBanner ? 'left' : 'center' }}>
          {title}
        </div>
        <div style={{ display: 'flex', width: isBanner ? 32 : 64 * scale + 16, height: 3, background: palette.accent }} />
        <div style={{ fontSize: authorSize, opacity: 0.85 }}>{author}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run the render tests**

Run: `npx vitest run lib/services/ads/render.test.ts`
Expected: PASS. The dimension test still confirms every size's real PNG width/height.

- [ ] **Step 9: Rewrite the generate route tests for the new behavior**

Replace `app/api/ads/projects/[id]/generate/route.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const book = {
  id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: '/api/files/ads/pub_1/cover.png',
  platforms: ['META'], copyTone: 'punchy', templateKey: 'bold',
}

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn() }))
vi.mock('@/lib/services/ads/copy', () => ({ generateAdCopy: vi.fn() }))
vi.mock('@/lib/services/ads/render', () => ({ renderCreativeImages: vi.fn() }))
vi.mock('@/lib/providers/storage', () => ({
  storeFile: vi.fn().mockResolvedValue({ url: '/api/files/ads/pub_1/creatives/x/meta_feed_1080x1080.png' }),
  readStoredFile: vi.fn().mockResolvedValue({ data: Buffer.from('cover'), contentType: 'image/png' }),
  toDataUri: vi.fn().mockReturnValue('data:image/png;base64,Y292ZXI='),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    creativeSet: { create: vi.fn().mockResolvedValue({ id: 'set_1' }) },
    book: { update: vi.fn().mockResolvedValue({}) },
  },
}))

import { POST } from './route'
import { generateAdCopy } from '@/lib/services/ads/copy'
import { renderCreativeImages } from '@/lib/services/ads/render'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { prisma } from '@/lib/db'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const metaImage = { sizeKey: 'meta_feed_1080x1080', platform: 'META' as const, width: 1080, height: 1080, pngBuffer: Buffer.from('png') }

describe('POST /api/ads/projects/:id/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue(book as any)
    vi.mocked(renderCreativeImages).mockResolvedValue([metaImage])
  })

  it('generates with the saved configuration and marks the project generated', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue([{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }])

    const res = await POST(new Request('http://localhost'), ctx('book_1'))

    expect(res.status).toBe(201)
    expect((await res.json()).creativeSetId).toBe('set_1')
    expect(generateAdCopy).toHaveBeenCalledWith({ title: 'T', author: 'A', blurb: 'B' }, { tone: 'punchy', platforms: ['META'] })
    expect(renderCreativeImages).toHaveBeenCalledWith(
      expect.objectContaining({ coverImageUrl: 'data:image/png;base64,Y292ZXI=', templateKey: 'bold', platforms: ['META'] })
    )
    expect(prisma.creativeSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookId: 'book_1',
          adCopies: { createMany: { data: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] } },
        }),
      })
    )
    expect(prisma.book.update).toHaveBeenCalledWith({ where: { id: 'book_1' }, data: { status: 'generated' } })
  })

  it('writes a blank, editable copy row per platform when copy generation fails', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue([])
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(201)
    expect(prisma.creativeSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adCopies: { createMany: { data: [{ platform: 'META', headline: '', primaryText: '', description: '' }] } },
        }),
      })
    )
  })

  it('returns a readable 500 and writes nothing when image rendering fails', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue([])
    vi.mocked(renderCreativeImages).mockRejectedValue(new Error('satori exploded'))
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/couldn.t generate/i)
    expect(prisma.creativeSet.create).not.toHaveBeenCalled()
    expect(prisma.book.update).not.toHaveBeenCalled()
  })

  it('returns 404 when the book does not belong to the caller', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await POST(new Request('http://localhost'), ctx('book_1'))).status).toBe(404)
  })

  it('returns 400 when the book has no cover image', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce({ ...book, frontCoverUrl: null } as any)
    expect((await POST(new Request('http://localhost'), ctx('book_1'))).status).toBe(400)
  })
})
```

- [ ] **Step 10: Run to verify they fail**

Run: `npx vitest run "app/api/ads/projects/[id]/generate/route.test.ts"`
Expected: the first three tests FAIL (no options passed, no blank rows, no status update, rendering error propagates).

- [ ] **Step 11: Rewrite `app/api/ads/projects/[id]/generate/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { generateAdCopy, type AdPlatform } from '@/lib/services/ads/copy'
import { renderCreativeImages } from '@/lib/services/ads/render'
import { readStoredFile, storeFile, toDataUri } from '@/lib/providers/storage'
import type { CopyTone } from '@/lib/services/ads/options'
import { prisma } from '@/lib/db'

export const maxDuration = 300

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!book.frontCoverUrl) {
    return NextResponse.json({ error: 'Add a cover image before generating.' }, { status: 400 })
  }

  const platforms = book.platforms as AdPlatform[]
  const details = { title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '' }

  try {
    const coverDataUri = toDataUri(await readStoredFile(book.frontCoverUrl))
    const [variants, renderedImages] = await Promise.all([
      generateAdCopy(details, { tone: book.copyTone as CopyTone, platforms }),
      renderCreativeImages({
        coverImageUrl: coverDataUri,
        title: details.title,
        author: details.author,
        templateKey: book.templateKey,
        platforms,
      }),
    ])

    // One editable row per selected platform, blank when AI copy failed.
    const copyRows = platforms.map(
      (platform) =>
        variants.find((v) => v.platform === platform) ?? { platform, headline: '', primaryText: '', description: '' }
    )

    const creativeSetId = crypto.randomUUID()
    const images = await Promise.all(
      renderedImages.map(async (img) => {
        const { url } = await storeFile(
          `ads/${publisherId}/creatives/${creativeSetId}/${img.sizeKey}.png`,
          img.pngBuffer,
          'image/png'
        )
        return { platform: img.platform, sizeKey: img.sizeKey, width: img.width, height: img.height, imageUrl: url }
      })
    )

    const creativeSet = await prisma.creativeSet.create({
      data: {
        id: creativeSetId,
        bookId: book.id,
        adCopies: {
          createMany: {
            data: copyRows.map(({ platform, headline, primaryText, description }) => ({
              platform,
              headline,
              primaryText,
              description,
            })),
          },
        },
        images: { createMany: { data: images } },
      },
    })
    await prisma.book.update({ where: { id: book.id }, data: { status: 'generated' } })

    return NextResponse.json({ creativeSetId: creativeSet.id }, { status: 201 })
  } catch (err) {
    console.error('ads generation failed', err)
    return NextResponse.json(
      { error: "We couldn't generate your creatives. Check your cover image and try again." },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 12: Run the route tests, then everything**

Run: `npx vitest run "app/api/ads/projects/[id]/generate/route.test.ts" && npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run`
Expected: route file PASS (5 tests); the whole suite passes.

- [ ] **Step 13: Commit**

```bash
git add lib/services/ads "app/api/ads/projects/[id]/generate"
git commit -m "feat: generate creatives from the saved platforms, tone and template with blank editable copy on failure"
```

---

### Task 9: Results APIs — edit copy, download ZIP, push (simulated locally)

The three server actions the Results screen needs: save edited ad copy, download everything as one ZIP, and "push to Meta/Google". Push returns a simulated receipt until the real OAuth plan lands.

**Files:**
- Modify: `lib/services/ads/queries.ts`, `lib/services/ads/queries.test.ts`, `lib/services/ads/options.ts`
- Create: `lib/services/ads/zip.ts`, `lib/services/ads/zip.test.ts`
- Create: `lib/providers/adsPush.ts`, `lib/providers/adsPush.test.ts`
- Create: `app/api/ads/copies/[id]/route.ts` (+ `route.test.ts`)
- Create: `app/api/ads/projects/[id]/download/route.ts` (+ `route.test.ts`)
- Create: `app/api/ads/projects/[id]/push/route.ts` (+ `route.test.ts`)
- Modify: `package.json` (jszip)

**Interfaces:**
- Consumes: `getBookForPublisher`, `getLatestCreativeSetForBook` (Task 1), `requireCurrentPublisherId` (Task 2), `readStoredFile` (Task 3), `PLATFORMS` (Task 7).
- Produces:
  - `getAdCopyForPublisher(publisherId: string, copyId: string): Promise<AdCopy | null>` in `@/lib/services/ads/queries`
  - `adCopyUpdateSchema` (zod: `headline` ≤150, `primaryText` ≤500, `description` ≤300, all required strings, may be empty) in `@/lib/services/ads/options`
  - `buildCreativeZip(input: { title: string; images: { platform: string; sizeKey: string; imageUrl: string }[]; copies: { platform: string; headline: string; primaryText: string; description: string }[] }, read?: typeof readStoredFile): Promise<Buffer>` in `@/lib/services/ads/zip`; also `zipFileName(title: string): string`
  - `@/lib/providers/adsPush` → `type PushPlatform = 'META' | 'GOOGLE'`, `interface PushReceipt { receiptId: string; platform: PushPlatform; campaignName: string; status: 'simulated' | 'submitted'; createdAt: string }`, `pushCreativeSet(input: { platform: PushPlatform; bookTitle: string; imageCount: number }): Promise<PushReceipt>`
  - HTTP: `PATCH /api/ads/copies/:id` (json) → 200 `{ id, headline, primaryText, description }` | 400 | 404; `GET /api/ads/projects/:id/download` → `application/zip` attachment | 404; `POST /api/ads/projects/:id/push` (json `{ platform }`) → 200 `PushReceipt` | 400 | 404

- [ ] **Step 1: Install jszip**

```bash
npm install jszip@3.10.2
```

- [ ] **Step 2: Write the failing scoped copy query test**

Add to `lib/services/ads/queries.test.ts` (and add `getAdCopyForPublisher` to its import):

```ts
describe('getAdCopyForPublisher', () => {
  it("finds a copy row only through its book's publisher", async () => {
    const book = await prisma.book.create({ data: { publisherId: 'pub_1', pdfUrl: 'x' } })
    const set = await prisma.creativeSet.create({
      data: { bookId: book.id, adCopies: { create: [{ platform: 'META', headline: 'H', primaryText: 'P', description: 'D' }] } },
      include: { adCopies: true },
    })
    const copyId = set.adCopies[0].id

    expect((await getAdCopyForPublisher('pub_1', copyId))?.id).toBe(copyId)
    expect(await getAdCopyForPublisher('pub_2', copyId)).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify it fails, then implement**

Run: `npx dotenv -e .env.test -- npx vitest run lib/services/ads/queries.test.ts`
Expected: FAIL, `getAdCopyForPublisher` is not exported.

Add to `lib/services/ads/queries.ts`:

```ts
import type { AdCopy } from '@prisma/client'

export function getAdCopyForPublisher(publisherId: string, copyId: string): Promise<AdCopy | null> {
  return prisma.adCopy.findFirst({ where: { id: copyId, creativeSet: { book: { publisherId } } } })
}
```

Add to `lib/services/ads/options.ts`:

```ts
export const adCopyUpdateSchema = z.object({
  headline: z.string().trim().max(150),
  primaryText: z.string().trim().max(500),
  description: z.string().trim().max(300),
})
```

Run again. Expected: PASS.

- [ ] **Step 4: Write the failing copy-edit route test**

`app/api/ads/copies/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getAdCopyForPublisher: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { adCopy: { update: vi.fn() } } }))

import { PATCH } from './route'
import { getAdCopyForPublisher } from '@/lib/services/ads/queries'
import { prisma } from '@/lib/db'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (body: unknown) =>
  new Request('http://localhost/api/ads/copies/copy_1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const edit = { headline: 'New headline', primaryText: 'New text', description: 'New desc' }

describe('PATCH /api/ads/copies/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves edited copy for the owner', async () => {
    vi.mocked(getAdCopyForPublisher).mockResolvedValue({ id: 'copy_1' } as any)
    vi.mocked(prisma.adCopy.update).mockResolvedValue({ id: 'copy_1', ...edit } as any)

    const res = await PATCH(req(edit), ctx('copy_1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'copy_1', ...edit })
    expect(prisma.adCopy.update).toHaveBeenCalledWith({ where: { id: 'copy_1' }, data: edit })
  })

  it("returns 404 for someone else's copy", async () => {
    vi.mocked(getAdCopyForPublisher).mockResolvedValue(null)
    expect((await PATCH(req(edit), ctx('copy_1'))).status).toBe(404)
    expect(prisma.adCopy.update).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid body', async () => {
    vi.mocked(getAdCopyForPublisher).mockResolvedValue({ id: 'copy_1' } as any)
    expect((await PATCH(req({ headline: 'x'.repeat(151), primaryText: '', description: '' }), ctx('copy_1'))).status).toBe(400)
  })
})
```

- [ ] **Step 5: Run to verify it fails, then implement `app/api/ads/copies/[id]/route.ts`**

Run: `npx vitest run "app/api/ads/copies/[id]/route.test.ts"`. Expected: FAIL, `Cannot find module './route'`.

```ts
import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAdCopyForPublisher } from '@/lib/services/ads/queries'
import { adCopyUpdateSchema } from '@/lib/services/ads/options'
import { prisma } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const copy = await getAdCopyForPublisher(publisherId, id)
  if (!copy) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = adCopyUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid copy' }, { status: 400 })
  }

  const updated = await prisma.adCopy.update({ where: { id: copy.id }, data: parsed.data })
  return NextResponse.json({
    id: updated.id,
    headline: updated.headline,
    primaryText: updated.primaryText,
    description: updated.description,
  })
}
```

Run again. Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing ZIP builder test**

`lib/services/ads/zip.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import JSZip from 'jszip'
import { buildCreativeZip, zipFileName } from './zip'

describe('buildCreativeZip', () => {
  it('puts images in per-platform folders and copy in copy.txt', async () => {
    const read = vi.fn(async (url: string) => ({ data: Buffer.from(`bytes:${url}`), contentType: 'image/png' }))
    const buffer = await buildCreativeZip(
      {
        title: 'The Lazy Developer',
        images: [
          { platform: 'META', sizeKey: 'meta_feed_1080x1080', imageUrl: '/a.png' },
          { platform: 'GOOGLE', sizeKey: 'google_display_728x90', imageUrl: '/b.png' },
        ],
        copies: [{ platform: 'META', headline: 'Hook', primaryText: 'Text', description: 'Desc' }],
      },
      read
    )

    const zip = await JSZip.loadAsync(buffer)
    expect(Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort()).toEqual([
      'copy.txt',
      'google/google_display_728x90.png',
      'meta/meta_feed_1080x1080.png',
    ])
    expect(await zip.file('meta/meta_feed_1080x1080.png')!.async('string')).toBe('bytes:/a.png')
    const copy = await zip.file('copy.txt')!.async('string')
    expect(copy).toContain('The Lazy Developer')
    expect(copy).toContain('META')
    expect(copy).toContain('Headline: Hook')
  })
})

describe('zipFileName', () => {
  it('slugifies the title', () => {
    expect(zipFileName('The Lazy Developer!')).toBe('the-lazy-developer-ad-creatives.zip')
    expect(zipFileName('')).toBe('book-ad-creatives.zip')
  })
})
```

- [ ] **Step 7: Run to verify it fails, then implement `lib/services/ads/zip.ts`**

Run: `npx vitest run lib/services/ads/zip.test.ts`. Expected: FAIL, `Cannot find module './zip'`.

```ts
import JSZip from 'jszip'
import { readStoredFile } from '@/lib/providers/storage'

type ZipInput = {
  title: string
  images: { platform: string; sizeKey: string; imageUrl: string }[]
  copies: { platform: string; headline: string; primaryText: string; description: string }[]
}

export function zipFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book'
  return `${slug}-ad-creatives.zip`
}

export async function buildCreativeZip(input: ZipInput, read: typeof readStoredFile = readStoredFile): Promise<Buffer> {
  const zip = new JSZip()

  for (const image of input.images) {
    const { data } = await read(image.imageUrl)
    zip.file(`${image.platform.toLowerCase()}/${image.sizeKey}.png`, data)
  }

  const copyText = [
    `${input.title || 'Untitled book'} — ad copy`,
    '',
    ...input.copies.flatMap((c) => [
      c.platform,
      `Headline: ${c.headline}`,
      `Primary text: ${c.primaryText}`,
      `Description: ${c.description}`,
      '',
    ]),
  ].join('\n')
  zip.file('copy.txt', copyText)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
```

Run again. Expected: PASS (2 tests).

- [ ] **Step 8: Write the failing download route test**

`app/api/ads/projects/[id]/download/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn(), getLatestCreativeSetForBook: vi.fn() }))
vi.mock('@/lib/services/ads/zip', () => ({
  buildCreativeZip: vi.fn().mockResolvedValue(Buffer.from('zip-bytes')),
  zipFileName: vi.fn().mockReturnValue('t-ad-creatives.zip'),
}))

import { GET } from './route'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/ads/projects/:id/download', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the zip as an attachment', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValue({ id: 'book_1', title: 'T' } as any)
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValue({ images: [], adCopies: [] } as any)

    const res = await GET(new Request('http://localhost'), ctx('book_1'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="t-ad-creatives.zip"')
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('zip-bytes')
  })

  it('returns 404 for a foreign book or when nothing is generated yet', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost'), ctx('book_1'))).status).toBe(404)

    vi.mocked(getBookForPublisher).mockResolvedValueOnce({ id: 'book_1', title: 'T' } as any)
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost'), ctx('book_1'))).status).toBe(404)
  })
})
```

- [ ] **Step 9: Run to verify it fails, then implement `app/api/ads/projects/[id]/download/route.ts`**

Run: `npx vitest run "app/api/ads/projects/[id]/download/route.test.ts"`. Expected: FAIL, `Cannot find module './route'`.

```ts
import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { buildCreativeZip, zipFileName } from '@/lib/services/ads/zip'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (!set) return NextResponse.json({ error: 'Nothing generated yet' }, { status: 404 })

  const buffer = await buildCreativeZip({ title: book.title ?? '', images: set.images, copies: set.adCopies })
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFileName(book.title ?? '')}"`,
    },
  })
}
```

Run again. Expected: PASS (2 tests).

- [ ] **Step 10: Write the failing push provider and route tests**

`lib/providers/adsPush.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pushCreativeSet } from './adsPush'

describe('pushCreativeSet (local)', () => {
  it('returns a simulated receipt naming the campaign', async () => {
    const receipt = await pushCreativeSet({ platform: 'META', bookTitle: 'The Lazy Developer', imageCount: 2 })
    expect(receipt.status).toBe('simulated')
    expect(receipt.platform).toBe('META')
    expect(receipt.campaignName).toBe('The Lazy Developer — Meta campaign')
    expect(receipt.receiptId).toMatch(/^sim_[a-z0-9]{8}$/)
    expect(Number.isNaN(Date.parse(receipt.createdAt))).toBe(false)
  })
})
```

`app/api/ads/projects/[id]/push/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/ads/queries', () => ({ getBookForPublisher: vi.fn(), getLatestCreativeSetForBook: vi.fn() }))
vi.mock('@/lib/providers/adsPush', () => ({ pushCreativeSet: vi.fn() }))

import { POST } from './route'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { pushCreativeSet } from '@/lib/providers/adsPush'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (body: unknown) =>
  new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('POST /api/ads/projects/:id/push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBookForPublisher).mockResolvedValue({ id: 'book_1', title: 'T' } as any)
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValue({ images: [{ platform: 'META' }, { platform: 'GOOGLE' }] } as any)
  })

  it("pushes the latest set's images for the chosen platform", async () => {
    vi.mocked(pushCreativeSet).mockResolvedValue({ receiptId: 'sim_12345678', platform: 'META', campaignName: 'c', status: 'simulated', createdAt: '2026-09-15T00:00:00.000Z' })
    const res = await POST(req({ platform: 'META' }), ctx('book_1'))
    expect(res.status).toBe(200)
    expect((await res.json()).receiptId).toBe('sim_12345678')
    expect(pushCreativeSet).toHaveBeenCalledWith({ platform: 'META', bookTitle: 'T', imageCount: 1 })
  })

  it('rejects Amazon and unknown platforms', async () => {
    expect((await POST(req({ platform: 'AMAZON' }), ctx('book_1'))).status).toBe(400)
    expect(pushCreativeSet).not.toHaveBeenCalled()
  })

  it('returns 400 when nothing is generated and 404 for a foreign book', async () => {
    vi.mocked(getLatestCreativeSetForBook).mockResolvedValueOnce(null)
    expect((await POST(req({ platform: 'META' }), ctx('book_1'))).status).toBe(400)
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    expect((await POST(req({ platform: 'META' }), ctx('book_1'))).status).toBe(404)
  })
})
```

- [ ] **Step 11: Run to verify they fail, then implement both**

Run: `npx vitest run lib/providers/adsPush.test.ts "app/api/ads/projects/[id]/push/route.test.ts"`. Expected: FAIL, modules not found.

`lib/providers/adsPush.ts`:

```ts
export type PushPlatform = 'META' | 'GOOGLE'

export interface PushReceipt {
  receiptId: string
  platform: PushPlatform
  campaignName: string
  status: 'simulated' | 'submitted'
  createdAt: string
}

const LABELS: Record<PushPlatform, string> = { META: 'Meta', GOOGLE: 'Google' }

// Real Meta Marketing API / Google Ads API push arrives with the OAuth
// connectors plan. Until then every push is simulated and says so.
export async function pushCreativeSet(input: {
  platform: PushPlatform
  bookTitle: string
  imageCount: number
}): Promise<PushReceipt> {
  return {
    receiptId: `sim_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    platform: input.platform,
    campaignName: `${input.bookTitle || 'Untitled book'} — ${LABELS[input.platform]} campaign`,
    status: 'simulated',
    createdAt: new Date().toISOString(),
  }
}
```

`app/api/ads/projects/[id]/push/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { pushCreativeSet } from '@/lib/providers/adsPush'

const bodySchema = z.object({ platform: z.enum(['META', 'GOOGLE']) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Push is available for Meta and Google only.' }, { status: 400 })
  }

  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (!set) return NextResponse.json({ error: 'Generate creatives before pushing.' }, { status: 400 })

  const receipt = await pushCreativeSet({
    platform: parsed.data.platform,
    bookTitle: book.title ?? '',
    imageCount: set.images.filter((i) => i.platform === parsed.data.platform).length,
  })
  return NextResponse.json(receipt)
}
```

Run again. Expected: PASS (1 + 3 tests).

- [ ] **Step 12: Run everything**

Run: `npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build`
Expected: all green; build lists `/api/ads/copies/[id]`, `/api/ads/projects/[id]/download`, `/api/ads/projects/[id]/push`.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json lib app/api/ads
git commit -m "feat: add copy editing, ZIP download and simulated ad push APIs"
```

---

### Task 10: Ads workspace — project rail, stepper, resume logic, hub "recent projects"

The frame inside a service. On mobile the rail becomes a horizontally scrolling strip above the content rather than a drawer, which is simpler and needs no extra overlay. A left rail lists the publisher's Ads projects. Each project has a header and a clickable 4-step stepper, and `/ads/<id>` sends you to the step where you left off. The hub gains a "Pick up where you left off" strip.

**Files:**
- Create: `lib/services/ads/steps.ts`, `lib/services/ads/steps.test.ts`, `lib/format.ts`, `lib/format.test.ts`
- Create: `components/platform/Stepper.tsx`, `components/platform/ProjectRail.tsx`, `components/platform/RailLink.tsx`, `components/platform/EmptyState.tsx`
- Create: `app/(platform)/ads/layout.tsx`, `app/(platform)/ads/page.tsx`, `app/(platform)/ads/[projectId]/layout.tsx`, `app/(platform)/ads/[projectId]/page.tsx`
- Modify: `app/(platform)/page.tsx`

**Interfaces:**
- Consumes: `getBooksForPublisher`, `getBookForPublisher`, `getLatestCreativeSetForBook` (Task 1), `requireCurrentPublisherId` (Task 2), `ProjectStatus` (Task 7), UI primitives (Task 5), `SERVICES`/`ServiceIcon` (Task 6).
- Produces:
  - `@/lib/services/ads/steps` → `type AdsStepKey = 'upload' | 'configure' | 'generate' | 'results'`, `ADS_STEPS: { key: AdsStepKey; label: string }[]`, `stepHref(projectId: string, step: AdsStepKey): string`, `resumeStep(status: string, hasCreativeSet: boolean): AdsStepKey`, `buildStepItems(projectId: string, status: string, hasCreativeSet: boolean): StepItem[]`, `statusDisplay(status: string): { label: string; tone: 'neutral' | 'accent' | 'success' }`
  - `@/components/platform/Stepper` → `interface StepItem { key: string; label: string; href: string; complete: boolean; reachable: boolean }`, `Stepper({ steps: StepItem[] })` (client; current step = the one whose key ends the URL)
  - `@/components/platform/EmptyState` → `EmptyState({ icon, title, description, action? })`
  - `@/lib/format` → `timeAgo(date: Date, now?: Date): string`
  - Routes: `/ads` (rail + empty/intro), `/ads/<id>` (redirect to resume step), `/ads/<id>/*` (project header + stepper wrap every step page)

- [ ] **Step 1: Write the failing steps and format tests**

`lib/services/ads/steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ADS_STEPS, buildStepItems, resumeStep, stepHref, statusDisplay } from './steps'

describe('ads steps', () => {
  it('has the four steps in order', () => {
    expect(ADS_STEPS.map((s) => s.key)).toEqual(['upload', 'configure', 'generate', 'results'])
    expect(stepHref('p1', 'configure')).toBe('/ads/p1/configure')
  })

  it('resumes where the publisher left off', () => {
    expect(resumeStep('uploaded', false)).toBe('upload')
    expect(resumeStep('configured', false)).toBe('configure')
    expect(resumeStep('generated', true)).toBe('results')
    expect(resumeStep('configured', true)).toBe('configure')
  })

  it('marks completion and reachability from status', () => {
    const uploaded = buildStepItems('p1', 'uploaded', false)
    expect(uploaded.map((s) => [s.key, s.complete, s.reachable])).toEqual([
      ['upload', true, true],
      ['configure', false, true],
      ['generate', false, false],
      ['results', false, false],
    ])

    const generated = buildStepItems('p1', 'generated', true)
    expect(generated.map((s) => s.complete)).toEqual([true, true, true, false])
    expect(generated.every((s) => s.reachable)).toBe(true)
    expect(generated[3].href).toBe('/ads/p1/results')
  })

  it('labels statuses for badges', () => {
    expect(statusDisplay('uploaded')).toEqual({ label: 'Needs setup', tone: 'neutral' })
    expect(statusDisplay('configured')).toEqual({ label: 'Ready to generate', tone: 'accent' })
    expect(statusDisplay('generated')).toEqual({ label: 'Creatives ready', tone: 'success' })
  })
})
```

`lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { timeAgo } from './format'

const now = new Date('2026-09-15T12:00:00Z')

describe('timeAgo', () => {
  it('describes recent times in plain words', () => {
    expect(timeAgo(new Date('2026-09-15T11:59:40Z'), now)).toBe('just now')
    expect(timeAgo(new Date('2026-09-15T11:15:00Z'), now)).toBe('45 minutes ago')
    expect(timeAgo(new Date('2026-09-15T09:00:00Z'), now)).toBe('3 hours ago')
    expect(timeAgo(new Date('2026-09-14T12:00:00Z'), now)).toBe('yesterday')
    expect(timeAgo(new Date('2026-09-01T12:00:00Z'), now)).toBe('2 weeks ago')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/services/ads/steps.test.ts lib/format.test.ts`
Expected: FAIL, modules not found

- [ ] **Step 3: Implement `lib/services/ads/steps.ts` and `lib/format.ts`**

`lib/services/ads/steps.ts`:

```ts
import type { StepItem } from '@/components/platform/Stepper'

export type AdsStepKey = 'upload' | 'configure' | 'generate' | 'results'

export const ADS_STEPS: { key: AdsStepKey; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'configure', label: 'Configure' },
  { key: 'generate', label: 'Generate' },
  { key: 'results', label: 'Results' },
]

export function stepHref(projectId: string, step: AdsStepKey): string {
  return `/ads/${projectId}/${step}`
}

export function resumeStep(status: string, hasCreativeSet: boolean): AdsStepKey {
  if (status === 'generated' && hasCreativeSet) return 'results'
  if (status === 'configured') return 'configure'
  return 'upload'
}

export function buildStepItems(projectId: string, status: string, hasCreativeSet: boolean): StepItem[] {
  const configured = status === 'configured' || status === 'generated'
  const generated = status === 'generated' && hasCreativeSet
  const state: Record<AdsStepKey, { complete: boolean; reachable: boolean }> = {
    upload: { complete: true, reachable: true },
    configure: { complete: configured, reachable: true },
    generate: { complete: generated, reachable: configured },
    results: { complete: false, reachable: hasCreativeSet },
  }
  return ADS_STEPS.map((s) => ({ ...s, href: stepHref(projectId, s.key), ...state[s.key] }))
}

export function statusDisplay(status: string): { label: string; tone: 'neutral' | 'accent' | 'success' } {
  if (status === 'generated') return { label: 'Creatives ready', tone: 'success' }
  if (status === 'configured') return { label: 'Ready to generate', tone: 'accent' }
  return { label: 'Needs setup', tone: 'neutral' }
}
```

`lib/format.ts`:

```ts
export function timeAgo(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 7) return rtf.format(-days, 'day')
  const weeks = Math.round(days / 7)
  if (weeks < 5) return rtf.format(-weeks, 'week')
  return rtf.format(-Math.round(days / 30), 'month')
}
```

- [ ] **Step 4: Run them**

Run: `npx vitest run lib/services/ads/steps.test.ts lib/format.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Create the workspace components**

`components/platform/Stepper.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/components/ui/cn'

export interface StepItem {
  key: string
  label: string
  href: string
  complete: boolean
  reachable: boolean
}

export function Stepper({ steps }: { steps: StepItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-2 overflow-x-auto sm:gap-3">
        {steps.map((step, index) => {
          const current = pathname.endsWith(`/${step.key}`)
          const circle = (
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                current && 'bg-accent text-on-accent ring-4 ring-accent/20',
                !current && step.complete && 'bg-success text-white',
                !current && !step.complete && 'border border-line bg-surface text-ink-muted'
              )}
            >
              {step.complete && !current ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </span>
          )
          const label = (
            <span className={cn('text-sm font-medium', current ? 'text-ink' : 'text-ink-muted')}>{step.label}</span>
          )
          return (
            <li key={step.key} className="flex items-center gap-2 sm:gap-3">
              {step.reachable ? (
                <Link
                  href={step.href}
                  aria-current={current ? 'step' : undefined}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-surface-2"
                >
                  {circle}
                  {label}
                </Link>
              ) : (
                <span className="flex cursor-not-allowed items-center gap-2 py-1 pl-1 pr-3 opacity-60" aria-disabled="true">
                  {circle}
                  {label}
                </span>
              )}
              {index < steps.length - 1 && <span className="h-px w-6 shrink-0 bg-line sm:w-10" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
```

`components/platform/RailLink.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export function RailLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2',
        active && 'bg-surface-2 ring-1 ring-line'
      )}
    >
      {children}
    </Link>
  )
}
```

`components/platform/ProjectRail.tsx`:

```tsx
import Link from 'next/link'
import { BookImage, Plus } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/format'
import { statusDisplay } from '@/lib/services/ads/steps'
import { RailLink } from './RailLink'

export interface RailProject {
  id: string
  title: string | null
  status: string
  frontCoverUrl: string | null
  updatedAt: Date
}

export function ProjectRail({ projects, newHref, basePath }: { projects: RailProject[]; newHref: string; basePath: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Link href={newHref} className={buttonClasses({ className: 'w-full' })}>
        <Plus className="size-4" aria-hidden /> New project
      </Link>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Your projects</h2>
        <span className="text-xs text-ink-muted">{projects.length}</span>
      </div>
      {projects.length === 0 ? (
        <p className="px-1 text-sm text-ink-muted">Projects you create will show up here.</p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {projects.map((p) => {
            const status = statusDisplay(p.status)
            return (
              <li key={p.id} className="min-w-56 lg:min-w-0">
                <RailLink href={`${basePath}/${p.id}`}>
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                    {p.frontCoverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.frontCoverUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <BookImage className="size-5 text-ink-muted" aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-medium">{p.title || 'Untitled book'}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="text-xs text-ink-muted">{timeAgo(p.updatedAt)}</span>
                    </span>
                  </span>
                </RailLink>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

`components/platform/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface/60 px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</span>
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-ink-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 6: Create the Ads routes**

`app/(platform)/ads/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBooksForPublisher } from '@/lib/services/ads/queries'
import { ProjectRail } from '@/components/platform/ProjectRail'

export const metadata: Metadata = { title: { default: 'Ads Creative', template: '%s · Ads Creative' } }
export const dynamic = 'force-dynamic'

export default async function AdsLayout({ children }: { children: React.ReactNode }) {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getBooksForPublisher(publisherId)

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[17rem_1fr] lg:gap-10 lg:py-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ProjectRail projects={projects} newHref="/ads/new" basePath="/ads" />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
```

`app/(platform)/ads/page.tsx`:

```tsx
import Link from 'next/link'
import { Megaphone, Plus, Sparkles, Settings2, Upload, Images } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBooksForPublisher } from '@/lib/services/ads/queries'
import { EmptyState } from '@/components/platform/EmptyState'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const HOW = [
  { icon: Upload, title: 'Upload', text: 'Drop in your book PDF. We pull the cover, title and blurb.' },
  { icon: Settings2, title: 'Configure', text: 'Choose platforms, a copy tone and a design template.' },
  { icon: Sparkles, title: 'Generate', text: 'AI writes the copy and composes every ad size.' },
  { icon: Images, title: 'Results', text: 'Polish the copy, download a ZIP, or push to your ad account.' },
]

export default async function AdsHomePage() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getBooksForPublisher(publisherId)
  const newButton = (
    <Link href="/ads/new" className={buttonClasses({ size: 'lg' })}>
      <Plus className="size-4" aria-hidden /> New ad project
    </Link>
  )

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Ads Creative</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Ads that sell your book</h1>
      </header>
      {projects.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-7" aria-hidden />}
          title="Create your first ad set"
          description="Upload a book and get ready-to-run creatives for Meta, Google and Amazon in a few minutes."
          action={newButton}
        />
      ) : (
        <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Pick a project or start a new one</h2>
            <p className="text-sm text-ink-muted">Your projects are on the left, each resumes right where you left off.</p>
          </div>
          {newButton}
        </Card>
      )}
      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-xs font-semibold uppercase tracking-widest text-ink-muted">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {HOW.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-card border border-line bg-surface p-5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                {i + 1}. {title}
              </span>
              <p className="mt-3 text-sm text-ink-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
```

`app/(platform)/ads/[projectId]/layout.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { BookImage } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { buildStepItems, statusDisplay } from '@/lib/services/ads/steps'
import { Stepper } from '@/components/platform/Stepper'
import { Badge } from '@/components/ui/badge'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  const status = statusDisplay(book.status)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 shadow-card">
            {book.frontCoverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.frontCoverUrl} alt={`Cover of ${book.title ?? 'this book'}`} className="size-full object-cover" />
            ) : (
              <BookImage className="size-6 text-ink-muted" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{book.title || 'Untitled book'}</h1>
            <p className="truncate text-sm text-ink-muted">{book.author || 'Unknown author'}</p>
          </div>
          <Badge tone={status.tone} className="ml-auto hidden sm:inline-flex">{status.label}</Badge>
        </div>
        <Stepper steps={buildStepItems(book.id, book.status, Boolean(set))} />
      </header>
      {children}
    </div>
  )
}
```

`app/(platform)/ads/[projectId]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { resumeStep, stepHref } from '@/lib/services/ads/steps'

export default async function ProjectIndex({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  redirect(stepHref(book.id, resumeStep(book.status, Boolean(set))))
}
```

- [ ] **Step 7: Add "Pick up where you left off" to the hub**

Replace `app/(platform)/page.tsx`:

```tsx
import Link from 'next/link'
import { BookImage } from 'lucide-react'
import { SERVICES } from '@/lib/services/registry'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBooksForPublisher } from '@/lib/services/ads/queries'
import { statusDisplay } from '@/lib/services/ads/steps'
import { timeAgo } from '@/lib/format'
import { ServiceCard } from '@/components/platform/ServiceCard'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function HubPage() {
  const publisherId = await requireCurrentPublisherId()
  const recent = (await getBooksForPublisher(publisherId)).slice(0, 4)

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Publisher Toolkit</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Every tool your book needs to find its readers.
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          Pick a tool to get started. Each one keeps its own projects, so you can focus on one thing at a time.
        </p>
      </header>

      <section aria-label="Tools" className="mt-10 grid gap-5 sm:grid-cols-2">
        {SERVICES.map((service) => (
          <ServiceCard key={service.key} service={service} />
        ))}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="mt-14">
          <h2 id="recent-heading" className="font-display text-2xl font-semibold tracking-tight">
            Pick up where you left off
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((p) => {
              const status = statusDisplay(p.status)
              return (
                <li key={p.id}>
                  <Link
                    href={`/ads/${p.id}`}
                    className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <span className="grid aspect-[4/3] place-items-center bg-surface-2">
                      {p.frontCoverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.frontCoverUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <BookImage className="size-8 text-ink-muted" aria-hidden />
                      )}
                    </span>
                    <span className="flex flex-col gap-2 p-4">
                      <span className="text-xs font-medium text-accent">Ads Creative</span>
                      <span className="truncate font-medium">{p.title || 'Untitled book'}</span>
                      <span className="flex items-center justify-between gap-2">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <span className="text-xs text-ink-muted">{timeAgo(p.updatedAt)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Verify**

```bash
npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build
npm run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 60); do grep -q "Ready in" /tmp/dev.log && break; sleep 1; done
PORT=$(grep -oE "localhost:[0-9]+" /tmp/dev.log | head -1 | cut -d: -f2)
curl -s http://localhost:$PORT/ads | grep -oE "Create your first ad set|Pick a project or start a new one|How it works" | sort -u
pkill -f "scripts/dev.mjs"; pkill -f "next dev"
```

Expected: all green; `/ads` shows `How it works` plus either the empty state or the pick-a-project card.

- [ ] **Step 9: Commit**

```bash
git add lib components "app/(platform)"
git commit -m "feat: add Ads workspace with project rail, resumable stepper and recent projects on the hub"
```

---

### Task 11: Upload step — dropzone, new project, details review with manual-cover fallback

The first screen of the flow. There's a drag-and-drop PDF upload with optional covers. After upload, a review screen shows the extracted cover, title, author and blurb as editable fields. When no cover was found it asks for one before you can continue.

**Files:**
- Create: `lib/services/ads/validation.ts`, `lib/services/ads/validation.test.ts`
- Create: `components/platform/Dropzone.tsx`, `components/ads/NewProjectForm.tsx`, `components/ads/DetailsReview.tsx`
- Create: `app/(platform)/ads/new/page.tsx`, `app/(platform)/ads/[projectId]/upload/page.tsx`
- Modify: `app/api/ads/projects/route.ts`, `app/api/ads/projects/[id]/route.ts` (use the shared rules)

**Interfaces:**
- Consumes: `POST /api/ads/projects` (multipart `pdf`, optional `frontCover`/`backCover`) → 201 `{ id, needsManualCover }` | 400 `{ error }`; `PATCH /api/ads/projects/:id` multipart covers or JSON details (Task 7); UI primitives (Task 5); `getBookForPublisher` (Task 1).
- Produces:
  - `@/lib/services/ads/validation` → `interface FileRule { accept: string[]; maxBytes: number; label: string }`, `PDF_RULE`, `COVER_RULE`, `validateFile(file: { type: string; size: number }, rule: FileRule): string | null`, `formatBytes(bytes: number): string`
  - `@/components/platform/Dropzone` → `Dropzone({ id, label, rule, file, onFileChange, hint?, compact? })` (client, reusable by every service)
  - Routes: `/ads/new` (create), `/ads/<id>/upload` (review), which navigates to `/ads/<id>/configure` on continue

- [ ] **Step 1: Write the failing validation test**

`lib/services/ads/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { COVER_RULE, PDF_RULE, formatBytes, validateFile } from './validation'

describe('validateFile', () => {
  it('accepts a PDF within the limit', () => {
    expect(validateFile({ type: 'application/pdf', size: 1024 }, PDF_RULE)).toBeNull()
  })

  it('explains wrong types, oversized and empty files', () => {
    expect(validateFile({ type: 'image/png', size: 10 }, PDF_RULE)).toBe("This file type isn't supported. Use a PDF up to 25 MB.")
    expect(validateFile({ type: 'application/pdf', size: 25 * 1024 * 1024 + 1 }, PDF_RULE)).toBe('This file is too large. Use a PDF up to 25 MB.')
    expect(validateFile({ type: 'image/png', size: 0 }, COVER_RULE)).toBe('This file is empty.')
    expect(validateFile({ type: 'image/svg+xml', size: 10 }, COVER_RULE)).toBe("This file type isn't supported. Use a PNG, JPG or WebP up to 10 MB.")
  })
})

describe('formatBytes', () => {
  it('formats human sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})
```

- [ ] **Step 2: Run to verify it fails, then implement `lib/services/ads/validation.ts`**

Run: `npx vitest run lib/services/ads/validation.test.ts`. Expected: FAIL, `Cannot find module './validation'`.

```ts
export interface FileRule {
  accept: string[]
  maxBytes: number
  label: string
}

export const PDF_RULE: FileRule = { accept: ['application/pdf'], maxBytes: 25 * 1024 * 1024, label: 'a PDF up to 25 MB' }

export const COVER_RULE: FileRule = {
  accept: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 10 * 1024 * 1024,
  label: 'a PNG, JPG or WebP up to 10 MB',
}

export function validateFile(file: { type: string; size: number }, rule: FileRule): string | null {
  if (file.size === 0) return 'This file is empty.'
  if (!rule.accept.includes(file.type)) return `This file type isn't supported. Use ${rule.label}.`
  if (file.size > rule.maxBytes) return `This file is too large. Use ${rule.label}.`
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KB`
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
}
```

Run again. Expected: PASS (3 tests).

- [ ] **Step 3: Use the shared rules in both upload routes**

In `app/api/ads/projects/route.ts` and `app/api/ads/projects/[id]/route.ts`, delete the local `MAX_PDF_BYTES` / `MAX_IMAGE_BYTES` / `ALLOWED_COVER_TYPES` constants and import the rules instead:

```ts
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'
```

Replace each use:
- `pdfFile.size > MAX_PDF_BYTES` → `pdfFile.size > PDF_RULE.maxBytes`
- `cover.size > MAX_IMAGE_BYTES` → `cover.size > COVER_RULE.maxBytes`
- `!ALLOWED_COVER_TYPES.has(cover.type)` → `!COVER_RULE.accept.includes(cover.type)`

Run: `npx vitest run app/api/ads/projects`
Expected: all existing route tests still PASS (the limits are unchanged).

- [ ] **Step 4: Create `components/platform/Dropzone.tsx`**

```tsx
'use client'
import { useId, useState, type DragEvent } from 'react'
import { FileText, ImageIcon, UploadCloud, X } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { formatBytes, validateFile, type FileRule } from '@/lib/services/ads/validation'

export function Dropzone({
  id,
  label,
  rule,
  file,
  onFileChange,
  hint,
  compact = false,
}: {
  id: string
  label: string
  rule: FileRule
  file: File | null
  onFileChange: (file: File | null) => void
  hint?: string
  compact?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  const isImage = rule.accept.every((t) => t.startsWith('image/'))

  function accept(candidate: File | undefined) {
    if (!candidate) return
    const problem = validateFile(candidate, rule)
    setError(problem)
    onFileChange(problem ? null : candidate)
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    accept(e.dataTransfer.files[0])
  }

  if (file) {
    const Icon = isImage ? ImageIcon : FileText
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-ink-muted">{formatBytes(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            aria-label={`Remove ${file.name}`}
            className="ml-auto grid size-8 place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        id={id}
        type="file"
        accept={rule.accept.join(',')}
        className="peer sr-only"
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface text-center transition-colors hover:border-accent/60 hover:bg-accent-soft/40',
          'peer-focus-visible:border-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent/20',
          compact ? 'px-4 py-6' : 'px-6 py-12',
          dragging && 'border-accent bg-accent-soft/60',
          error && 'border-danger/60'
        )}
      >
        <span className={cn('grid place-items-center rounded-2xl bg-accent-soft text-accent', compact ? 'size-10' : 'size-14')}>
          <UploadCloud className={compact ? 'size-5' : 'size-7'} aria-hidden />
        </span>
        <span className={cn('font-medium', compact ? 'text-sm' : 'text-base')}>
          <span className="text-accent">Choose a file</span> or drag it here
        </span>
        <span className="text-xs text-ink-muted">{hint ?? `Use ${rule.label}`}</span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `components/ads/NewProjectForm.tsx`**

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { Dropzone } from '@/components/platform/Dropzone'
import { COVER_RULE, PDF_RULE } from '@/lib/services/ads/validation'

export function NewProjectForm() {
  const router = useRouter()
  const [pdf, setPdf] = useState<File | null>(null)
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [showCovers, setShowCovers] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pdf) {
      setError('Choose your book PDF to continue.')
      return
    }
    setPending(true)
    setError(null)
    const body = new FormData()
    body.append('pdf', pdf)
    if (front) body.append('frontCover', front)
    if (back) body.append('backCover', back)

    const res = await fetch('/api/ads/projects', { method: 'POST', body })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      setError(json.error ?? 'Something went wrong uploading your book. Please try again.')
      return
    }
    toast.success('Book uploaded', { description: 'Check the details we found, then continue.' })
    router.push(`/ads/${json.id}/upload`)
    router.refresh()
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <Dropzone id="pdf" label="Book PDF" rule={PDF_RULE} file={pdf} onFileChange={setPdf} />

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setShowCovers((s) => !s)}
            aria-expanded={showCovers}
            className="flex items-center gap-2 self-start text-sm font-medium text-accent"
          >
            <ChevronDown className={cn('size-4 transition-transform', showCovers && 'rotate-180')} aria-hidden />
            Add your own cover images (optional)
          </button>
          {showCovers && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Dropzone id="frontCover" label="Front cover" rule={COVER_RULE} file={front} onFileChange={setFront} compact />
              <Dropzone id="backCover" label="Back cover" rule={COVER_RULE} file={back} onFileChange={setBack} compact />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="size-4" aria-hidden /> Your files stay private to your account.
          </p>
          <Button type="submit" size="lg" loading={pending} disabled={!pdf}>
            {pending ? 'Reading your book…' : 'Upload and continue'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
```

- [ ] **Step 6: Create `components/ads/DetailsReview.tsx`**

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Dropzone } from '@/components/platform/Dropzone'
import { COVER_RULE } from '@/lib/services/ads/validation'

export function DetailsReview({
  projectId,
  initial,
  coverUrl,
}: {
  projectId: string
  initial: { title: string; author: string; blurb: string }
  coverUrl: string | null
}) {
  const router = useRouter()
  const [details, setDetails] = useState(initial)
  const [newCover, setNewCover] = useState<File | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const needsCover = !coverUrl

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (needsCover && !newCover) {
      setError('Add a front cover to continue.')
      return
    }
    setPending(true)
    setError(null)

    if (newCover) {
      const body = new FormData()
      body.append('frontCover', newCover)
      const res = await fetch(`/api/ads/projects/${projectId}`, { method: 'PATCH', body })
      if (!res.ok) {
        setPending(false)
        setError((await res.json().catch(() => ({}))).error ?? 'We couldn’t save that cover. Please try again.')
        return
      }
    }

    const res = await fetch(`/api/ads/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    })
    if (!res.ok) {
      setPending(false)
      setError((await res.json().catch(() => ({}))).error ?? 'We couldn’t save your details. Please try again.')
      return
    }

    toast.success('Details saved')
    router.push(`/ads/${projectId}/configure`)
    router.refresh()
  }

  const set = (key: keyof typeof details) => (value: string) => setDetails((d) => ({ ...d, [key]: value }))

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[18rem_1fr]" noValidate>
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-semibold">Cover</h2>
        {needsCover ? (
          <>
            <p className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              We couldn’t find a cover in your PDF. Add one to continue.
            </p>
            <Dropzone id="frontCover" label="Front cover" rule={COVER_RULE} file={newCover} onFileChange={setNewCover} compact />
          </>
        ) : replacing ? (
          <Dropzone id="frontCover" label="New front cover" rule={COVER_RULE} file={newCover} onFileChange={setNewCover} compact />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={`Cover of ${details.title || 'your book'}`} className="w-full rounded-xl shadow-lift" />
            <Button type="button" variant="secondary" size="sm" onClick={() => setReplacing(true)}>
              Replace cover
            </Button>
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Book details</h2>
          <p className="text-sm text-ink-muted">We pulled these from your PDF. They shape your ads, so tweak anything that’s off.</p>
        </div>
        <Field label="Title" htmlFor="title">
          <Input id="title" value={details.title} onChange={(e) => set('title')(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Author" htmlFor="author">
          <Input id="author" value={details.author} onChange={(e) => set('author')(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Blurb" htmlFor="blurb" hint="A few sentences about the book, used to write your ad copy.">
          <Textarea id="blurb" rows={6} value={details.blurb} onChange={(e) => set('blurb')(e.target.value)} maxLength={2000} />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={pending} className="self-end">
          Save and continue <ArrowRight className="size-4" aria-hidden />
        </Button>
      </Card>
    </form>
  )
}
```

- [ ] **Step 7: Create the two pages**

`app/(platform)/ads/new/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { NewProjectForm } from '@/components/ads/NewProjectForm'

export const metadata: Metadata = { title: 'New project' }

export default function NewAdsProjectPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Step 1 of 4</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Upload your book</h1>
        <p className="mt-2 text-ink-muted">We’ll pull the cover, title, author and blurb straight from your PDF.</p>
      </header>
      <NewProjectForm />
    </div>
  )
}
```

`app/(platform)/ads/[projectId]/upload/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { DetailsReview } from '@/components/ads/DetailsReview'

export default async function UploadStepPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()

  return (
    <DetailsReview
      key={book.updatedAt.toISOString()}
      projectId={book.id}
      coverUrl={book.frontCoverUrl}
      initial={{ title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '' }}
    />
  )
}
```

- [ ] **Step 8: Verify**

```bash
npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build
npm run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 60); do grep -q "Ready in" /tmp/dev.log && break; sleep 1; done
PORT=$(grep -oE "localhost:[0-9]+" /tmp/dev.log | head -1 | cut -d: -f2)
curl -s http://localhost:$PORT/ads/new | grep -oE "Upload your book|Choose a file|Upload and continue" | sort -u
ID=$(curl -s -X POST http://localhost:$PORT/api/ads/projects -F "pdf=@e2e/fixtures/sample-book.pdf;type=application/pdf" | node -pe "JSON.parse(require('fs').readFileSync(0)).id")
curl -s http://localhost:$PORT/ads/$ID/upload | grep -oE "Book details|Save and continue|Add one to continue|Replace cover" | sort -u
pkill -f "scripts/dev.mjs"; pkill -f "next dev"
```

Expected: all green; `/ads/new` shows the three strings; the review page shows `Book details` and `Save and continue`, plus either `Replace cover` or `Add one to continue` depending on whether extraction found a cover.

- [ ] **Step 9: Commit**

```bash
git add lib/services/ads/validation.ts lib/services/ads/validation.test.ts components "app/(platform)/ads" app/api/ads/projects
git commit -m "feat: add Upload step with drag-and-drop dropzone, details review and manual cover fallback"
```

---

### Task 12: Configure and Generate steps

Configure uses selectable cards for platforms (with the sizes each one produces), a copy tone with a live sample headline, and templates shown as miniature previews. Generate is a staged progress screen. It lands on Results when generation succeeds, or returns to Configure with the error and a "Try again" action when it fails.

**Files:**
- Create: `components/ads/ConfigureForm.tsx`, `components/ads/GenerateRunner.tsx`
- Create: `app/(platform)/ads/[projectId]/configure/page.tsx`, `app/(platform)/ads/[projectId]/generate/page.tsx`

**Interfaces:**
- Consumes: `PLATFORMS`, `TONES`, `TEMPLATES`, `CopyTone`, `TemplateKey` (Task 7); `CREATIVE_SIZES` (Task 1); `sampleAdCopy` (Task 2); `PATCH /api/ads/projects/:id` JSON config (Task 7); `POST /api/ads/projects/:id/generate` → 201 `{ creativeSetId }` | 4xx/500 `{ error }` (Task 8); `stepHref` (Task 10); UI primitives (Task 5).
- Produces:
  - `ConfigureForm({ projectId, initial: { platforms: AdPlatform[]; copyTone: CopyTone; templateKey: TemplateKey }, book: { title: string; author: string; blurb: string; coverUrl: string | null }, error?: string })`
  - `GenerateRunner({ projectId, platformCount, sizeCount })`
  - `/ads/<id>/configure?error=<message>` shows a failed-generation banner with "Try again"

- [ ] **Step 1: Create `components/ads/ConfigureForm.tsx`**

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import type { AdPlatform } from '@/lib/services/ads/copy'
import { PLATFORMS, TEMPLATES, TONES, type CopyTone, type TemplateKey } from '@/lib/services/ads/options'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'
import { sampleAdCopy } from '@/lib/services/ads/sampleCopy'

const sizesFor = (platform: AdPlatform) =>
  CREATIVE_SIZES.filter((s) => s.platform === platform).map((s) => `${s.width}×${s.height}`)

export function ConfigureForm({
  projectId,
  initial,
  book,
  error: generationError,
}: {
  projectId: string
  initial: { platforms: AdPlatform[]; copyTone: CopyTone; templateKey: TemplateKey }
  book: { title: string; author: string; blurb: string; coverUrl: string | null }
  error?: string
}) {
  const router = useRouter()
  const [platforms, setPlatforms] = useState<AdPlatform[]>(initial.platforms)
  const [copyTone, setCopyTone] = useState<CopyTone>(initial.copyTone)
  const [templateKey, setTemplateKey] = useState<TemplateKey>(initial.templateKey)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const togglePlatform = (key: AdPlatform) =>
    setPlatforms((current) => (current.includes(key) ? current.filter((p) => p !== key) : [...current, key]))

  const previewHeadline = sampleAdCopy(book, copyTone)[0].headline

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (platforms.length === 0) {
      setError('Choose at least one platform.')
      return
    }
    setPending(true)
    setError(null)
    const res = await fetch(`/api/ads/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms: PLATFORMS.map((p) => p.key).filter((k) => platforms.includes(k)), copyTone, templateKey }),
    })
    if (!res.ok) {
      setPending(false)
      const message = (await res.json().catch(() => ({}))).error ?? 'We couldn’t save your settings.'
      setError(message)
      toast.error(message)
      return
    }
    router.push(`/ads/${projectId}/generate`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {generationError && (
        <div role="alert" className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger/10 p-4 sm:flex-row sm:items-center">
          <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">Generation didn’t finish.</span> {generationError}
          </p>
          <Button type="submit" variant="danger" size="sm" className="sm:ml-auto" loading={pending}>
            Try again
          </Button>
        </div>
      )}

      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Where will these ads run?</legend>
          <p className="text-sm text-ink-muted">We’ll make every size each platform needs.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PLATFORMS.map((p) => {
              const selected = platforms.includes(p.key)
              return (
                <button
                  key={p.key}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => togglePlatform(p.key)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all',
                    selected ? 'border-accent bg-accent-soft/50 ring-2 ring-accent/30' : 'border-line bg-surface hover:border-accent/40'
                  )}
                >
                  <span
                    className={cn(
                      'absolute right-3 top-3 grid size-5 place-items-center rounded-full border',
                      selected ? 'border-accent bg-accent text-on-accent' : 'border-line'
                    )}
                  >
                    {selected && <Check className="size-3" aria-hidden />}
                  </span>
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-xs text-ink-muted">{p.description}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {sizesFor(p.key).map((s) => (
                      <span key={s} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">{s}</span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Copy tone</legend>
          <div role="radiogroup" aria-label="Copy tone" className="mt-4 grid gap-3 sm:grid-cols-3">
            {TONES.map((t) => {
              const selected = copyTone === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCopyTone(t.key)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all',
                    selected ? 'border-accent bg-accent-soft/50 ring-2 ring-accent/30' : 'border-line bg-surface hover:border-accent/40'
                  )}
                >
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-xs text-ink-muted">{t.description}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm" aria-live="polite">
            <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
            <span className="text-ink-muted">Sample headline:</span>
            <span className="font-medium">{previewHeadline}</span>
          </p>
        </fieldset>
      </Card>

      <Card className="p-6">
        <fieldset>
          <legend className="font-display text-lg font-semibold">Design template</legend>
          <div role="radiogroup" aria-label="Design template" className="mt-4 grid gap-4 sm:grid-cols-3">
            {TEMPLATES.map((t) => {
              const selected = templateKey === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTemplateKey(t.key)}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-2xl border text-left transition-all',
                    selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-accent/40'
                  )}
                >
                  <span
                    className="flex aspect-square flex-col items-center justify-center gap-2 p-4"
                    style={{ background: t.palette.background, color: t.palette.ink }}
                    aria-hidden
                  >
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={book.coverUrl} alt="" className="h-1/2 rounded-md object-cover shadow-lg" />
                    ) : (
                      <span className="h-1/2 w-1/3 rounded-md bg-current opacity-20" />
                    )}
                    <span className="line-clamp-1 font-display text-sm font-semibold">{book.title || 'Your book'}</span>
                    <span className="h-0.5 w-8" style={{ background: t.palette.accent }} />
                  </span>
                  <span className="flex flex-col gap-0.5 bg-surface p-3">
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="text-xs text-ink-muted">{t.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-ink-muted">
          {platforms.length === 0
            ? 'No platforms selected'
            : `${CREATIVE_SIZES.filter((s) => platforms.includes(s.platform)).length} ad sizes`}
        </span>
        <Button type="submit" size="lg" loading={pending} disabled={platforms.length === 0}>
          <Sparkles className="size-4" aria-hidden /> Generate creatives
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create `components/ads/GenerateRunner.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'

const STAGES = ['Reading your book', 'Writing ad copy', 'Composing images', 'Saving your creatives']
const STAGE_MS = 2200

export function GenerateRunner({
  projectId,
  platformCount,
  sizeCount,
}: {
  projectId: string
  platformCount: number
  sizeCount: number
}) {
  const router = useRouter()
  const started = useRef(false)
  const [stage, setStage] = useState(0)

  useEffect(() => {
    // React strict mode mounts twice in dev; generation must run once.
    if (started.current) return
    started.current = true

    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), STAGE_MS)

    ;(async () => {
      const res = await fetch(`/api/ads/projects/${projectId}/generate`, { method: 'POST' }).catch(() => null)
      clearInterval(timer)
      if (res?.ok) {
        setStage(STAGES.length)
        toast.success('Your creatives are ready')
        router.replace(`/ads/${projectId}/results`)
        router.refresh()
        return
      }
      const message = (await res?.json().catch(() => ({})))?.error ?? 'Something went wrong. Please try again.'
      router.replace(`/ads/${projectId}/configure?error=${encodeURIComponent(message)}`)
      router.refresh()
    })()

    return () => clearInterval(timer)
  }, [projectId, router])

  const percent = Math.round((Math.min(stage + 1, STAGES.length) / STAGES.length) * 100)

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 p-8 text-center sm:p-10">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" aria-hidden />
        <span className="grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-lift">
          <Loader2 className="size-7 animate-spin" aria-hidden />
        </span>
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Creating your ads</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {sizeCount} sizes across {platformCount} {platformCount === 1 ? 'platform' : 'platforms'}. This usually takes under a minute.
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <ol className="flex w-full flex-col gap-3 text-left" aria-live="polite">
        {STAGES.map((label, i) => {
          const done = i < stage
          const active = i === stage
          return (
            <li key={label} className={cn('flex items-center gap-3 text-sm', !done && !active && 'text-ink-muted')}>
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full',
                  done && 'bg-success text-white',
                  active && 'bg-accent-soft text-accent',
                  !done && !active && 'border border-line'
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : active ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              </span>
              <span className={cn(active && 'font-medium')}>{label}</span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
```

- [ ] **Step 3: Create the two pages**

`app/(platform)/ads/[projectId]/configure/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { ConfigureForm } from '@/components/ads/ConfigureForm'
import type { AdPlatform } from '@/lib/services/ads/copy'
import type { CopyTone, TemplateKey } from '@/lib/services/ads/options'

export default async function ConfigureStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { projectId } = await params
  const { error } = await searchParams
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()

  return (
    <ConfigureForm
      projectId={book.id}
      error={error}
      initial={{
        platforms: book.platforms as AdPlatform[],
        copyTone: book.copyTone as CopyTone,
        templateKey: book.templateKey as TemplateKey,
      }}
      book={{ title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '', coverUrl: book.frontCoverUrl }}
    />
  )
}
```

`app/(platform)/ads/[projectId]/generate/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { CREATIVE_SIZES } from '@/lib/services/ads/sizes'
import { GenerateRunner } from '@/components/ads/GenerateRunner'

export default async function GenerateStepPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  if (book.status === 'uploaded') redirect(`/ads/${book.id}/configure`)
  if (!book.frontCoverUrl) redirect(`/ads/${book.id}/upload`)

  const sizeCount = CREATIVE_SIZES.filter((s) => book.platforms.includes(s.platform)).length
  return <GenerateRunner projectId={book.id} platformCount={book.platforms.length} sizeCount={sizeCount} />
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build
npm run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 60); do grep -q "Ready in" /tmp/dev.log && break; sleep 1; done
PORT=$(grep -oE "localhost:[0-9]+" /tmp/dev.log | head -1 | cut -d: -f2)
ID=$(curl -s -X POST http://localhost:$PORT/api/ads/projects -F "pdf=@e2e/fixtures/sample-book.pdf;type=application/pdf" | node -pe "JSON.parse(require('fs').readFileSync(0)).id")
curl -s http://localhost:$PORT/ads/$ID/configure | grep -oE "Where will these ads run\?|Copy tone|Design template|Generate creatives" | sort -u
curl -s "http://localhost:$PORT/ads/$ID/configure?error=Boom" | grep -oE "Generation didn.t finish|Try again" | sort -u
curl -s -o /dev/null -w "generate-before-config %{http_code} %{redirect_url}\n" http://localhost:$PORT/ads/$ID/generate
pkill -f "scripts/dev.mjs"; pkill -f "next dev"
```

Expected: all green; configure shows the four section strings; the `?error=` variant shows the banner and `Try again`; opening generate before configuring redirects (307) to `/ads/<id>/configure`.

- [ ] **Step 5: Commit**

```bash
git add components/ads "app/(platform)/ads/[projectId]"
git commit -m "feat: add Configure step with platform, tone and template pickers and staged Generate step"
```

---

### Task 13: Results step — gallery with lightbox, copy editor, ZIP download, push panel

The payoff screen. Creatives are grouped by platform and shown at their true aspect ratio, and clicking one opens a full-size preview. Each platform's copy is editable, with platform character guides. There's one-click ZIP download, and Meta/Google push shows a clearly labelled simulated receipt in local mode.

**Files:**
- Modify: `lib/services/ads/options.ts`, `lib/services/ads/options.test.ts`
- Create: `components/ads/CreativeGallery.tsx`, `components/ads/CopyEditor.tsx`, `components/ads/PushPanel.tsx`
- Create: `app/(platform)/ads/[projectId]/results/page.tsx`

**Interfaces:**
- Consumes: `getBookForPublisher`, `getLatestCreativeSetForBook` (Task 1); `PLATFORMS` (Task 7); `PATCH /api/ads/copies/:id`, `GET /api/ads/projects/:id/download`, `POST /api/ads/projects/:id/push` → `PushReceipt` (Task 9); `getCapabilityStatus` (Task 2); UI primitives (Task 5).
- Produces:
  - `COPY_LIMITS: Record<AdPlatform, { headline: number; primaryText: number; description: number }>` in `@/lib/services/ads/options`
  - `CreativeGallery({ images: { id: string; sizeKey: string; width: number; height: number; imageUrl: string }[]; platformLabel: string })`
  - `CopyEditor({ copy: { id: string; platform: AdPlatform; headline: string; primaryText: string; description: string } })`
  - `PushPanel({ projectId: string; platforms: AdPlatform[]; simulated: boolean })`

- [ ] **Step 1: Write the failing copy-limits test**

Add to `lib/services/ads/options.test.ts` (and add `COPY_LIMITS`, `adCopyUpdateSchema` to its import):

```ts
describe('COPY_LIMITS', () => {
  it('gives a guide per platform that fits within what the API accepts', () => {
    expect(COPY_LIMITS.META).toEqual({ headline: 40, primaryText: 125, description: 90 })
    expect(COPY_LIMITS.GOOGLE).toEqual({ headline: 30, primaryText: 90, description: 90 })
    for (const limits of Object.values(COPY_LIMITS)) {
      const atLimit = {
        headline: 'x'.repeat(limits.headline),
        primaryText: 'x'.repeat(limits.primaryText),
        description: 'x'.repeat(limits.description),
      }
      expect(adCopyUpdateSchema.safeParse(atLimit).success).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails, then add the limits to `options.ts`**

Run: `npx vitest run lib/services/ads/options.test.ts`. Expected: FAIL, `COPY_LIMITS` is not exported.

```ts
export const COPY_LIMITS: Record<AdPlatform, { headline: number; primaryText: number; description: number }> = {
  META: { headline: 40, primaryText: 125, description: 90 },
  GOOGLE: { headline: 30, primaryText: 90, description: 90 },
  AMAZON: { headline: 80, primaryText: 150, description: 90 },
}
```

Run again. Expected: PASS.

- [ ] **Step 3: Create `components/ads/CreativeGallery.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, Expand, X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'

type GalleryImage = { id: string; sizeKey: string; width: number; height: number; imageUrl: string }

export function CreativeGallery({ images, platformLabel }: { images: GalleryImage[]; platformLabel: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [active, setActive] = useState<GalleryImage | null>(null)

  useEffect(() => {
    if (active) dialogRef.current?.showModal()
  }, [active])

  const alt = (img: GalleryImage) => `${platformLabel} ad, ${img.width}×${img.height}`

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((img) => (
          <li key={img.id} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setActive(img)}
              className="relative flex h-64 items-center justify-center bg-[repeating-conic-gradient(var(--color-surface-2)_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-4"
              aria-label={`Preview ${alt(img)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt={alt(img)}
                style={{ aspectRatio: `${img.width} / ${img.height}` }}
                className="max-h-full max-w-full rounded-md object-contain shadow-lift"
              />
              <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-canvas/90 text-ink opacity-0 shadow-card transition-opacity group-hover:opacity-100">
                <Expand className="size-4" aria-hidden />
              </span>
            </button>
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">{img.width}×{img.height}</span>
                <span className="font-mono text-[11px] text-ink-muted">{img.sizeKey}</span>
              </span>
              <a href={img.imageUrl} download={`${img.sizeKey}.png`} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                <Download className="size-4" aria-hidden /> Download
              </a>
            </div>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setActive(null)}
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="m-auto max-h-[90dvh] max-w-[90vw] rounded-card bg-surface p-0 text-ink shadow-lift backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        {active && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
              <span className="text-sm font-medium">{alt(active)}</span>
              <div className="flex items-center gap-2">
                <a href={active.imageUrl} download={`${active.sizeKey}.png`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                  <Download className="size-4" aria-hidden /> Download
                </a>
                <button
                  type="button"
                  onClick={() => dialogRef.current?.close()}
                  aria-label="Close preview"
                  className="grid size-8 place-items-center rounded-full hover:bg-surface-2"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="grid place-items-center bg-surface-2 p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.imageUrl} alt={alt(active)} className="max-h-[75dvh] max-w-full rounded-md object-contain" />
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
```

- [ ] **Step 4: Create `components/ads/CopyEditor.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { cn } from '@/components/ui/cn'
import type { AdPlatform } from '@/lib/services/ads/copy'
import { COPY_LIMITS } from '@/lib/services/ads/options'

type Copy = { id: string; platform: AdPlatform; headline: string; primaryText: string; description: string }
type Key = 'headline' | 'primaryText' | 'description'

const LABELS: Record<Key, string> = { headline: 'Headline', primaryText: 'Primary text', description: 'Description' }

function Counter({ length, limit }: { length: number; limit: number }) {
  return (
    <span className={cn('text-xs tabular-nums', length > limit ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-ink-muted')}>
      {length}/{limit}
    </span>
  )
}

export function CopyEditor({ copy }: { copy: Copy }) {
  const [saved, setSaved] = useState(copy)
  const [draft, setDraft] = useState(copy)
  const [pending, setPending] = useState(false)
  const limits = COPY_LIMITS[copy.platform]
  const dirty = (['headline', 'primaryText', 'description'] as Key[]).some((k) => draft[k] !== saved[k])
  const blank = !saved.headline && !saved.primaryText && !saved.description

  async function save() {
    setPending(true)
    const res = await fetch(`/api/ads/copies/${copy.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headline: draft.headline, primaryText: draft.primaryText, description: draft.description }),
    })
    setPending(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'We couldn’t save your copy.')
      return
    }
    const next = { ...copy, ...(await res.json()) }
    setSaved(next)
    setDraft(next)
    toast.success('Copy saved')
  }

  const field = (key: Key) => {
    const id = `${copy.id}-${key}`
    const props = { id, value: draft[key], onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value })) }
    return (
      <Field label={LABELS[key]} htmlFor={id}>
        {key === 'primaryText' ? <Textarea rows={3} maxLength={500} {...props} /> : <Input maxLength={key === 'headline' ? 150 : 300} {...props} />}
        <span className="self-end">
          <Counter length={draft[key].length} limit={limits[key]} />
        </span>
      </Field>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {blank && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <PenLine className="size-4 shrink-0" aria-hidden />
          We couldn’t write copy for this platform. Add your own below.
        </p>
      )}
      {field('headline')}
      {field('primaryText')}
      {field('description')}
      <div className="flex items-center justify-end gap-2">
        {dirty && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(saved)}>
            Discard
          </Button>
        )}
        <Button type="button" size="sm" onClick={save} loading={pending} disabled={!dirty}>
          Save copy
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `components/ads/PushPanel.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, FlaskConical, Send, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { AdPlatform } from '@/lib/services/ads/copy'
import type { PushReceipt } from '@/lib/providers/adsPush'

const PUSHABLE = [
  { key: 'META', label: 'Meta Ads' },
  { key: 'GOOGLE', label: 'Google Ads' },
] as const

export function PushPanel({ projectId, platforms, simulated }: { projectId: string; platforms: AdPlatform[]; simulated: boolean }) {
  const [pending, setPending] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<Record<string, PushReceipt>>({})
  const available = PUSHABLE.filter((p) => platforms.includes(p.key))

  async function push(platform: (typeof PUSHABLE)[number]) {
    setPending(platform.key)
    const res = await fetch(`/api/ads/projects/${projectId}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: platform.key }),
    })
    setPending(null)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(json.error ?? `Couldn’t push to ${platform.label}.`)
      return
    }
    setReceipts((r) => ({ ...r, [platform.key]: json }))
    toast.success(`Sent to ${platform.label}`, { description: json.campaignName })
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Launch a campaign</h2>
          <p className="text-sm text-ink-muted">Send these creatives straight to your ad account.</p>
        </div>
        {simulated && (
          <Badge tone="warning" title="Ad account connections are simulated while running locally.">
            <FlaskConical className="size-3.5" aria-hidden /> Simulated
          </Badge>
        )}
      </div>

      {available.length === 0 && <p className="text-sm text-ink-muted">Select Meta or Google in Configure to push directly.</p>}

      <ul className="flex flex-col gap-3">
        {available.map((p) => {
          const receipt = receipts[p.key]
          return (
            <li key={p.key} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{p.label}</span>
                <Button size="sm" variant={receipt ? 'secondary' : 'primary'} loading={pending === p.key} onClick={() => push(p)}>
                  <Send className="size-4" aria-hidden /> {receipt ? 'Push again' : 'Connect & push'}
                </Button>
              </div>
              {receipt && (
                <p className="flex items-start gap-2 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {receipt.campaignName}
                    <span className="block font-mono text-xs text-ink-muted">
                      Receipt {receipt.receiptId}{receipt.status === 'simulated' ? ' · simulated' : ''}
                    </span>
                  </span>
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {platforms.includes('AMAZON') && (
        <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink-muted">
          <ShoppingBag className="mt-0.5 size-4 shrink-0" aria-hidden />
          Amazon doesn’t offer self-serve uploads from other tools. Download the ZIP and add the 300×250 creative in Amazon Ads.
        </p>
      )}
    </Card>
  )
}
```

- [ ] **Step 6: Create `app/(platform)/ads/[projectId]/results/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Download, RefreshCw } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getCapabilityStatus } from '@/lib/providers/status'
import { getBookForPublisher, getLatestCreativeSetForBook } from '@/lib/services/ads/queries'
import { PLATFORMS } from '@/lib/services/ads/options'
import type { AdPlatform } from '@/lib/services/ads/copy'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CreativeGallery } from '@/components/ads/CreativeGallery'
import { CopyEditor } from '@/components/ads/CopyEditor'
import { PushPanel } from '@/components/ads/PushPanel'

export default async function ResultsStepPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, projectId)
  if (!book) notFound()
  const set = await getLatestCreativeSetForBook(book.id, publisherId)
  if (!set) redirect(`/ads/${book.id}/configure`)

  const sections = PLATFORMS.map((p) => ({
    ...p,
    images: set.images.filter((i) => i.platform === p.key),
    copy: set.adCopies.find((c) => c.platform === p.key),
  })).filter((s) => s.images.length > 0 || s.copy)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Your creatives</h2>
          <p className="text-sm text-ink-muted">
            {set.images.length} images across {sections.length} {sections.length === 1 ? 'platform' : 'platforms'}. Edit copy, download, or launch.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/ads/${book.id}/configure`} className={buttonClasses({ variant: 'ghost' })}>
            <RefreshCw className="size-4" aria-hidden /> Regenerate
          </Link>
          <a href={`/api/ads/projects/${book.id}/download`} className={buttonClasses({ variant: 'secondary' })}>
            <Download className="size-4" aria-hidden /> Download all (.zip)
          </a>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {sections.map((s) => (
            <Card key={s.key} className="flex flex-col gap-5 p-6">
              <div>
                <h3 className="font-display text-xl font-semibold">{s.label}</h3>
                <p className="text-sm text-ink-muted">{s.description}</p>
              </div>
              {s.images.length > 0 && <CreativeGallery images={s.images} platformLabel={s.label} />}
              {s.copy && (
                <div className="rounded-2xl border border-line bg-canvas p-5">
                  <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-ink-muted">Ad copy</h4>
                  <CopyEditor copy={{ ...s.copy, platform: s.copy.platform as AdPlatform }} />
                </div>
              )}
            </Card>
          ))}
        </div>
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <PushPanel
            projectId={book.id}
            platforms={book.platforms as AdPlatform[]}
            simulated={getCapabilityStatus().adsPush === 'local'}
          />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify the whole flow over HTTP**

```bash
npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build
npm run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 60); do grep -q "Ready in" /tmp/dev.log && break; sleep 1; done
PORT=$(grep -oE "localhost:[0-9]+" /tmp/dev.log | head -1 | cut -d: -f2)
B=http://localhost:$PORT
ID=$(curl -s -X POST $B/api/ads/projects -F "pdf=@e2e/fixtures/sample-book.pdf;type=application/pdf" | node -pe "JSON.parse(require('fs').readFileSync(0)).id")
node -e "const z=require('zlib');const c=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');require('fs').writeFileSync('/tmp/cover.png',c)"
curl -s -X PATCH $B/api/ads/projects/$ID -F "frontCover=@/tmp/cover.png;type=image/png" > /dev/null
curl -s -X PATCH $B/api/ads/projects/$ID -H 'Content-Type: application/json' -d '{"platforms":["META","GOOGLE","AMAZON"],"copyTone":"punchy","templateKey":"bold"}' > /dev/null
curl -s -w " %{http_code}\n" -X POST $B/api/ads/projects/$ID/generate
curl -s $B/ads/$ID/results | grep -oE "Your creatives|Download all \(.zip\)|Launch a campaign|Simulated|Meta ad, 1080×1080|Amazon doesn" | sort -u
curl -s -o /tmp/set.zip -w "zip %{http_code} %{content_type}\n" $B/api/ads/projects/$ID/download
curl -s -X POST $B/api/ads/projects/$ID/push -H 'Content-Type: application/json' -d '{"platform":"META"}'
pkill -f "scripts/dev.mjs"; pkill -f "next dev"
```

Expected: all green; generate prints `{"creativeSetId":"…"} 201`; the results page lists every grep string; `zip 200 application/zip`; push prints a receipt JSON with `"status":"simulated"`.

- [ ] **Step 8: Commit**

```bash
git add lib/services/ads/options.ts lib/services/ads/options.test.ts components/ads "app/(platform)/ads/[projectId]/results"
git commit -m "feat: add Results step with creative gallery, editable copy, ZIP download and push panel"
```

---

### Task 14: Retire the old dashboard, friendly error pages, local end-to-end test, visual check

Removes the scaffold routes and adds designed error and 404 states. It makes sign-in pages safe in local mode, runs the whole Ads flow in a real browser with no credentials, and verifies every key screen visually in light, dark and mobile.

**Files:**
- Delete: `app/dashboard/` (all files), `e2e/generate-creatives.spec.ts`
- Create: `app/(platform)/error.tsx`, `app/(platform)/not-found.tsx`, `app/(platform)/ads/[projectId]/loading.tsx`
- Modify: `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`, `proxy.ts`
- Modify: `playwright.config.ts`, `package.json` (remove `@clerk/testing`)
- Create: `e2e/fixtures/cover.png` (generated once, committed), `e2e/ads.spec.ts`

**Interfaces:**
- Consumes: every route and component from Tasks 1–13; `isClerkConfigured` (Task 2); `EmptyState` (Task 10); `buttonClasses` (Task 5).
- Produces: `npm run test:e2e` runs the full local flow against `npm run dev -- --port 3100` and writes screenshots to `test-results/screens/`.

- [ ] **Step 1: Remove the scaffold routes and the Clerk-only e2e**

```bash
git rm -r app/dashboard e2e/generate-creatives.spec.ts
npm uninstall @clerk/testing
grep -rn "/dashboard" app components lib proxy.ts e2e
```

Expected: the grep prints nothing.

- [ ] **Step 2: Protect every platform route (real-auth mode) in `proxy.ts`**

Replace the matcher line:

```ts
const isProtectedRoute = createRouteMatcher(['/((?!sign-in|sign-up).*)'])
```

The rest of `proxy.ts` is unchanged. Local mode still passes straight through.

- [ ] **Step 3: Make sign-in/sign-up safe in local mode**

`app/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { SignIn } from '@clerk/nextjs'
import { isClerkConfigured } from '@/lib/providers/auth'

export default function Page() {
  if (!isClerkConfigured()) redirect('/')
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <SignIn />
    </main>
  )
}
```

`app/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import { isClerkConfigured } from '@/lib/providers/auth'

export default function Page() {
  if (!isClerkConfigured()) redirect('/')
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <SignUp />
    </main>
  )
}
```

- [ ] **Step 4: Add the friendly error and 404 states**

`app/(platform)/error.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { useEffect } from 'react'
import { LifeBuoy, RotateCcw } from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/button'

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-danger/10 text-danger">
        <LifeBuoy className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Something went sideways</h1>
      <p className="mt-3 text-ink-muted">That didn’t load the way it should. Your projects are safe, so try again.</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden /> Try again
        </Button>
        <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
          All tools
        </Link>
      </div>
    </div>
  )
}
```

`app/(platform)/not-found.tsx`:

```tsx
import Link from 'next/link'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/platform/EmptyState'
import { buttonClasses } from '@/components/ui/button'

export default function PlatformNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <EmptyState
        icon={<Compass className="size-7" aria-hidden />}
        title="We couldn’t find that page"
        description="The project may have been removed, or the link is out of date."
        action={
          <Link href="/" className={buttonClasses()}>
            Back to all tools
          </Link>
        }
      />
    </div>
  )
}
```

- [ ] **Step 4b: Add a skeleton while a step loads**

`app/(platform)/ads/[projectId]/loading.tsx`. The project header and stepper live in the layout and stay visible, so only the step body shows placeholders:

```tsx
export default function ProjectStepLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="h-24 animate-pulse rounded-card bg-surface-2" />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="h-72 animate-pulse rounded-card bg-surface-2" />
        <div className="h-72 animate-pulse rounded-card bg-surface-2" />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Generate the committed cover fixture**

```bash
node -e "
const { createCanvas } = require('@napi-rs/canvas')
const c = createCanvas(600, 900); const g = c.getContext('2d')
const grad = g.createLinearGradient(0, 0, 0, 900); grad.addColorStop(0, '#1e3a8a'); grad.addColorStop(1, '#0f172a')
g.fillStyle = grad; g.fillRect(0, 0, 600, 900)
g.fillStyle = '#fbbf24'; g.fillRect(60, 520, 480, 6)
g.fillStyle = '#ffffff'; g.font = 'bold 64px serif'; g.fillText('The Lazy', 60, 420); g.fillText('Developer', 60, 500)
g.font = '32px sans-serif'; g.fillText('Jane Coder', 60, 590)
require('fs').writeFileSync('e2e/fixtures/cover.png', c.toBuffer('image/png'))
"
file e2e/fixtures/cover.png
```

Expected: `PNG image data, 600 x 900`

- [ ] **Step 6: Point Playwright at a local-mode dev server**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Force local mode regardless of the developer's shell.
    env: { CLERK_SECRET_KEY: '', BLOB_READ_WRITE_TOKEN: '', AI_GATEWAY_API_KEY: '', VERCEL_OIDC_TOKEN: '' },
  },
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

- [ ] **Step 7: Write the end-to-end test `e2e/ads.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const fixture = (name: string) => path.join(__dirname, 'fixtures', name)
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true })

test('publisher creates ads end to end in local mode', async ({ page }) => {
  // Hub
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Every tool your book needs to find its readers.' })).toBeVisible()
  await expect(page.getByText('Local mode')).toBeVisible()
  await shot(page, 'hub-light')

  // Into Ads Creative
  await page.getByRole('link', { name: /Ads Creative/ }).first().click()
  await expect(page).toHaveURL(/\/ads$/)
  await page.getByRole('link', { name: /New (ad )?project/ }).first().click()

  // Upload
  await page.locator('#pdf').setInputFiles(fixture('sample-book.pdf'))
  await expect(page.getByText('sample-book.pdf')).toBeVisible()
  await page.getByRole('button', { name: 'Upload and continue' }).click()
  await expect(page).toHaveURL(/\/ads\/[^/]+\/upload$/)
  await expect(page.getByRole('heading', { name: 'Book details' })).toBeVisible()

  // Always use the known-good cover so rendering is deterministic.
  if (await page.getByText('Add one to continue').isVisible()) {
    await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  } else {
    await page.getByRole('button', { name: 'Replace cover' }).click()
    await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  }
  await page.getByLabel('Title').fill('The Lazy Developer')
  await page.getByLabel('Author').fill('Jane Coder')
  await page.getByLabel('Blurb').fill('A story about shipping less code and loving it.')
  await page.getByRole('button', { name: 'Save and continue' }).click()

  // Configure
  await expect(page).toHaveURL(/\/configure$/)
  // "Bold" is both a tone and a template, so scope each pick to its group.
  await page.getByRole('radiogroup', { name: 'Copy tone' }).getByRole('radio', { name: /Punchy/ }).click()
  await page.getByRole('radiogroup', { name: 'Design template' }).getByRole('radio', { name: /Bold/ }).click()
  await expect(page.getByRole('checkbox', { name: /Meta/ })).toHaveAttribute('aria-checked', 'true')
  await shot(page, 'configure-light')
  await page.getByRole('button', { name: 'Generate creatives' }).click()

  // Generate → Results
  await expect(page.getByRole('heading', { name: 'Creating your ads' })).toBeVisible()
  await expect(page).toHaveURL(/\/results$/, { timeout: 120_000 })
  await expect(page.getByRole('img', { name: 'Meta ad, 1080×1080' }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: 'Google ad, 728×90' }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: 'Amazon ad, 300×250' }).first()).toBeVisible()
  await shot(page, 'results-light')

  // Lightbox
  await page.getByRole('button', { name: 'Preview Meta ad, 1080×1080' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close preview' }).click()

  // Edit copy
  const headline = page.getByLabel('Headline').first()
  await headline.fill('Ship less. Read more.')
  await page.getByRole('button', { name: 'Save copy' }).first().click()
  await expect(page.getByText('Copy saved')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Headline').first()).toHaveValue('Ship less. Read more.')

  // Push (simulated)
  await page.getByRole('button', { name: 'Connect & push' }).first().click()
  await expect(page.getByText(/Receipt sim_[a-z0-9]{8} · simulated/)).toBeVisible()

  // ZIP download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download all (.zip)' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('the-lazy-developer-ad-creatives.zip')

  // Resume: project link on the hub goes straight back to Results
  await page.goto('/')
  await page.getByRole('link', { name: /The Lazy Developer/ }).first().click()
  await expect(page).toHaveURL(/\/results$/)

  // Dark theme and mobile screenshots of the key screens
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await shot(page, 'results-dark')
  await page.goto('/')
  await shot(page, 'hub-dark')
  await page.setViewportSize({ width: 400, height: 860 })
  await shot(page, 'hub-mobile-dark')
})

test('coming-soon services and unknown projects have designed states', async ({ page }) => {
  await page.goto('/trailer')
  await expect(page.getByRole('heading', { name: 'Trailer Video' })).toBeVisible()
  await expect(page.getByText('Coming soon').first()).toBeVisible()

  await page.goto('/ads/not-a-real-project/results')
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page' })).toBeVisible()
})
```

- [ ] **Step 8: Run the end-to-end tests**

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: `2 passed`. The screenshots `hub-light`, `configure-light`, `results-light`, `results-dark`, `hub-dark` and `hub-mobile-dark` exist under `test-results/screens/`. If a step fails, open the trace (`npx playwright show-trace test-results/**/trace.zip`), fix the app code the failing task owns, and re-run. Don't loosen assertions.

- [ ] **Step 9: Visually review every screenshot**

Open each file in `test-results/screens/` with the Read tool and check it against this list. Fix anything that fails, then re-run Step 8.

- The top bar is one row with logo, switcher, Local mode badge, theme toggle and avatar; nothing wraps or overlaps.
- The hub heading uses the serif display face; the four cards have distinct icon tints and equal heights; at 400px they stack one per row with no horizontal scroll.
- On Configure, the selected cards visibly differ (accent border and ring); the three template previews show different palettes.
- On Results, creatives keep their true aspect ratios (the 728×90 banner is wide and short, the story is tall); copy fields are legible; the push panel sits beside the gallery on desktop.
- In dark mode the backgrounds are dark, text is light with clear contrast, and no pure-white panels are left over.
- Nothing shows raw unstyled HTML, default browser buttons, or clipped text.

- [ ] **Step 10: Run the full verification**

Run: `npx tsc --noEmit && npx dotenv -e .env.test -- npx vitest run && npm run build && npm run test:e2e`
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add -A app e2e playwright.config.ts proxy.ts package.json package-lock.json
git commit -m "feat: retire scaffold dashboard, add error states and a full local end-to-end test with visual checks"
```
