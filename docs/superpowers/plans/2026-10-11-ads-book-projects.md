# Ads Book Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Ads tool, a project is a book: one page per book shows its A+ images, video ad and ad images, each made and saved separately; written books get one reusable Ads project via "Promote this book".

**Architecture:** The root `Book` row (`parentBookId IS NULL`) is the project; each creation stays a child `Book` row with its own `contentGoal` (the existing campaign mechanism, never named in the UI). A pure module groups child outputs into the three rows; a small service loads projects and syncs a written book's root through a new unique `Book.creatorProjectId`. Existing configure → generate → results pages are reused unchanged for making each item.

**Tech Stack:** Next.js App Router (this repo's version — read `node_modules/next/dist/docs/` before using unfamiliar APIs), React 19, Prisma + PostgreSQL, Tailwind, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-books-projects-design.md`

## Global Constraints

- Home page (`app/(platform)/page.tsx`) keeps its two tool cards and the top-bar `ServiceSwitcher`; only "Pick up where you left off" changes.
- The UI never says "campaign" on new/changed screens. Row names, exactly: `A+ images for Amazon`, `Video ad`, `Ad images`, in that order.
- No new dependencies. No changes to configure / generate / results page behavior beyond the header back link.
- Git identity before committing: `git config user.name "Vijendrapratap"` and `git config user.email "44225657+Vijendrapratap@users.noreply.github.com"`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not commit `scripts/dev.mjs` (the user's unrelated local change).
- Unit tests: `npm test -- <path>` (loads `.env.test`; DB-backed tests need the test DB migrated — Task 1). Typecheck: `npx tsc --noEmit`.

## Review Focus

1. **A written book clicked "Promote" twice** → same project both times, never a second root. (Task 4 test: two syncs → one row.)
2. **Legacy all-in-one campaigns (`contentGoal` `all`/NULL), including a root that was itself a campaign** → their images/video appear under the right rows, not hidden. (Task 2 tests.)
3. **Another publisher's book id typed into `/ads/books/[id]`** → 404, never their data. (Task 4 test: `getAdsProject` scoped by publisher.)
4. **Child id typed into `/ads/books/[id]`** (e.g. from an old link) → redirect to its book's project page. (Task 8 step.)
5. **Clicking Create while an unfinished item of the same kind exists** → "Continue unfinished" is offered instead of creating yet another draft. (Task 2 draft tests + Task 8 UI rule.)

---

### Task 1: `Book.creatorProjectId` column

**Files:**
- Modify: `prisma/schema.prisma` (model `Book`)
- Create: `prisma/migrations/20261011120000_book_creator_project_link/migration.sql`

**Interfaces:**
- Produces: `Book.creatorProjectId: string | null` (unique) on the Prisma client.

- [ ] **Step 1: Add the field** — in `model Book`, after `parentBookId      String?`:

```prisma
  creatorProjectId  String?       @unique
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- A written book (BookCreatorProject) gets at most one Ads project root.
ALTER TABLE "Book" ADD COLUMN "creatorProjectId" TEXT;
CREATE UNIQUE INDEX "Book_creatorProjectId_key" ON "Book"("creatorProjectId");
```

- [ ] **Step 3: Apply and regenerate**

Run: `npx prisma generate && npx dotenv -e .env.test -- npx prisma migrate deploy`
Expected: "All migrations have been successfully applied." (The dev DB picks it up on the next `npm run dev`, which runs `migrate deploy`.)

- [ ] **Step 4: Typecheck** — Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261011120000_book_creator_project_link
git commit -m "feat(ads): link a written book to one ads project root

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Group a project's outputs into rows (pure)

**Files:**
- Create: `lib/services/ads/projectAssets.ts`
- Test: `lib/services/ads/projectAssets.test.ts`

**Interfaces:**
- Consumes: `CREATIVE_SIZES` from `lib/services/ads/sizes.ts` (`{ key, category?: 'sponsored' | 'aplus' }`).
- Produces:
  - `type AssetKind = 'aplus' | 'video' | 'sponsored'`
  - `ASSET_KINDS: AssetKind[]` = `['aplus', 'video', 'sponsored']`
  - `ASSET_LABELS: Record<AssetKind, string>`
  - `interface ProjectRow { id; contentGoal: string | null; createdAt: Date; set: {...} | null; aiVideo: {...} | null }`
  - `interface AssetVersion { rowId; createdAt: Date; imageUrls: string[]; videoUrl: string | null; posterUrl: string | null; durationSec: number | null }`
  - `interface AssetGroup { latest: AssetVersion | null; earlier: AssetVersion[]; draftRowId: string | null }`
  - `groupProjectAssets(rows: ProjectRow[]): Record<AssetKind, AssetGroup>`
  - `summarizeProject(groups: Record<AssetKind, AssetGroup>): string`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/services/ads/projectAssets.test.ts
import { describe, it, expect } from 'vitest'
import { groupProjectAssets, summarizeProject, type ProjectRow } from './projectAssets'

const d = (day: number) => new Date(Date.UTC(2026, 9, day))
const APLUS = 'amazon_aplus_banner_970x600'
const SPONSORED = 'amazon_300x250'

function row(over: Partial<ProjectRow> & { id: string }): ProjectRow {
  return { contentGoal: null, createdAt: d(1), set: null, aiVideo: null, ...over }
}
function set(day: number, images: [string, string][], video?: { url: string; poster?: string; duration?: number }) {
  return {
    createdAt: d(day),
    videoUrl: video?.url ?? null,
    videoPosterUrl: video?.poster ?? null,
    videoDuration: video?.duration ?? null,
    images: images.map(([sizeKey, imageUrl]) => ({ sizeKey, imageUrl })),
  }
}

describe('groupProjectAssets', () => {
  it('puts each creation in its own row and keeps the newest as latest', () => {
    const groups = groupProjectAssets([
      row({ id: 'a1', contentGoal: 'aplus', createdAt: d(2), set: set(2, [[APLUS, 'old.png']]) }),
      row({ id: 'a2', contentGoal: 'aplus', createdAt: d(5), set: set(5, [[APLUS, 'new.png']]) }),
      row({ id: 's1', contentGoal: 'sponsored', createdAt: d(3), set: set(3, [[SPONSORED, 'ad.png']]) }),
    ])
    expect(groups.aplus.latest?.rowId).toBe('a2')
    expect(groups.aplus.latest?.imageUrls).toEqual(['new.png'])
    expect(groups.aplus.earlier.map((v) => v.rowId)).toEqual(['a1'])
    expect(groups.sponsored.latest?.imageUrls).toEqual(['ad.png'])
    expect(groups.video.latest).toBeNull()
  })

  it('splits a legacy all-in-one set across the rows by what it contains', () => {
    const groups = groupProjectAssets([
      row({
        id: 'root',
        contentGoal: 'all',
        set: set(4, [[APLUS, 'hero.png'], [SPONSORED, 'banner.png']], { url: 'v.mp4', poster: 'p.png', duration: 15 }),
      }),
    ])
    expect(groups.aplus.latest?.imageUrls).toEqual(['hero.png'])
    expect(groups.sponsored.latest?.imageUrls).toEqual(['banner.png'])
    expect(groups.video.latest).toMatchObject({ rowId: 'root', videoUrl: 'v.mp4', posterUrl: 'p.png', durationSec: 15 })
  })

  it('treats a NULL goal like a legacy bundle', () => {
    const groups = groupProjectAssets([row({ id: 'r', contentGoal: null, set: set(1, [[SPONSORED, 'x.png']]) })])
    expect(groups.sponsored.latest?.rowId).toBe('r')
  })

  it('does not leak an explicit goal row into other rows', () => {
    const groups = groupProjectAssets([
      row({ id: 's', contentGoal: 'sponsored', set: set(1, [[SPONSORED, 'x.png'], [APLUS, 'stray.png']]) }),
    ])
    expect(groups.aplus.latest).toBeNull()
  })

  it('counts a finished AI video when the set has none, and prefers the newer video', () => {
    const groups = groupProjectAssets([
      row({ id: 'v1', contentGoal: 'video', set: set(1, []), aiVideo: { videoUrl: 'ai.mp4', posterUrl: 'ai.png', createdAt: d(2) } }),
      row({
        id: 'v2',
        contentGoal: 'video',
        createdAt: d(3),
        set: set(3, [], { url: 'instant.mp4' }),
        aiVideo: { videoUrl: 'ai2.mp4', posterUrl: null, createdAt: d(6) },
      }),
    ])
    expect(groups.video.latest).toMatchObject({ rowId: 'v2', videoUrl: 'ai2.mp4' })
    expect(groups.video.earlier[0]).toMatchObject({ rowId: 'v1', videoUrl: 'ai.mp4', posterUrl: 'ai.png' })
  })

  it('reports the newest unfinished creation as a draft only when it is newer than the latest version', () => {
    const groups = groupProjectAssets([
      row({ id: 'oldDraft', contentGoal: 'aplus', createdAt: d(1) }),
      row({ id: 'done', contentGoal: 'aplus', createdAt: d(2), set: set(2, [[APLUS, 'a.png']]) }),
      row({ id: 'newDraft', contentGoal: 'aplus', createdAt: d(3) }),
      row({ id: 'vDraft', contentGoal: 'video', createdAt: d(1) }),
    ])
    expect(groups.aplus.draftRowId).toBe('newDraft')
    expect(groups.video.draftRowId).toBe('vDraft')
    expect(groups.sponsored.draftRowId).toBeNull()
  })

  it('never reports a legacy bundle row as a draft', () => {
    const groups = groupProjectAssets([row({ id: 'root', contentGoal: 'all' })])
    expect(groups.aplus.draftRowId).toBeNull()
    expect(groups.video.draftRowId).toBeNull()
    expect(groups.sponsored.draftRowId).toBeNull()
  })
})

describe('summarizeProject', () => {
  it('lists what exists, in row order', () => {
    const groups = groupProjectAssets([
      row({ id: 's', contentGoal: 'sponsored', set: set(1, [[SPONSORED, 'x.png']]) }),
      row({ id: 'a', contentGoal: 'aplus', set: set(1, [[APLUS, 'y.png']]) }),
    ])
    expect(summarizeProject(groups)).toBe('A+ images · Ad images')
  })

  it('says when nothing has been made', () => {
    expect(summarizeProject(groupProjectAssets([]))).toBe('Nothing made yet')
  })
})
```

- [ ] **Step 2: Run to verify failure** — Run: `npm test -- lib/services/ads/projectAssets.test.ts` — Expected: FAIL, cannot resolve `./projectAssets`.

- [ ] **Step 3: Implement**

```ts
// lib/services/ads/projectAssets.ts
import { CREATIVE_SIZES } from './sizes'

// A book's Ads project is its root Book row plus one child row per creation.
// This turns those rows into the three things a person can make.

export type AssetKind = 'aplus' | 'video' | 'sponsored'

export const ASSET_KINDS: AssetKind[] = ['aplus', 'video', 'sponsored']

export const ASSET_LABELS: Record<AssetKind, string> = {
  aplus: 'A+ images for Amazon',
  video: 'Video ad',
  sponsored: 'Ad images',
}

const SHORT_LABELS: Record<AssetKind, string> = { aplus: 'A+ images', video: 'Video', sponsored: 'Ad images' }

export interface ProjectRow {
  id: string
  contentGoal: string | null
  createdAt: Date
  /** Latest CreativeSet of this row. */
  set: {
    createdAt: Date
    videoUrl: string | null
    videoPosterUrl: string | null
    videoDuration: number | null
    images: { imageUrl: string; sizeKey: string }[]
  } | null
  /** Latest completed AiVideoJob of this row. */
  aiVideo: { videoUrl: string | null; posterUrl: string | null; createdAt: Date } | null
}

export interface AssetVersion {
  rowId: string
  createdAt: Date
  imageUrls: string[]
  videoUrl: string | null
  posterUrl: string | null
  durationSec: number | null
}

export interface AssetGroup {
  latest: AssetVersion | null
  earlier: AssetVersion[]
  /** Newest creation of this kind that has no output yet and is newer than `latest`. */
  draftRowId: string | null
}

// Sizes without a category (old Meta/Google sizes) are ad images.
const SIZE_KIND = new Map<string, AssetKind>(CREATIVE_SIZES.map((s) => [s.key, s.category ?? 'sponsored']))

function isKind(goal: string | null): goal is AssetKind {
  return goal === 'aplus' || goal === 'video' || goal === 'sponsored'
}

const newestFirst = <T extends { createdAt: Date }>(a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime()

function versionFor(row: ProjectRow, kind: AssetKind): AssetVersion | null {
  if (kind === 'video') {
    const candidates: AssetVersion[] = []
    if (row.set?.videoUrl) {
      candidates.push({
        rowId: row.id,
        createdAt: row.set.createdAt,
        imageUrls: [],
        videoUrl: row.set.videoUrl,
        posterUrl: row.set.videoPosterUrl,
        durationSec: row.set.videoDuration,
      })
    }
    if (row.aiVideo?.videoUrl) {
      candidates.push({
        rowId: row.id,
        createdAt: row.aiVideo.createdAt,
        imageUrls: [],
        videoUrl: row.aiVideo.videoUrl,
        posterUrl: row.aiVideo.posterUrl,
        durationSec: null,
      })
    }
    return candidates.sort(newestFirst)[0] ?? null
  }
  const imageUrls = (row.set?.images ?? [])
    .filter((i) => (SIZE_KIND.get(i.sizeKey) ?? 'sponsored') === kind)
    .map((i) => i.imageUrl)
  if (!row.set || imageUrls.length === 0) return null
  return { rowId: row.id, createdAt: row.set.createdAt, imageUrls, videoUrl: null, posterUrl: null, durationSec: null }
}

export function groupProjectAssets(rows: ProjectRow[]): Record<AssetKind, AssetGroup> {
  const groups = {} as Record<AssetKind, AssetGroup>
  for (const kind of ASSET_KINDS) {
    // Explicit-goal rows belong to one kind; legacy bundle rows (all / NULL) to any kind they contain.
    const candidates = rows.filter((r) => !isKind(r.contentGoal) || r.contentGoal === kind)
    const versions = candidates
      .map((r) => versionFor(r, kind))
      .filter((v): v is AssetVersion => v !== null)
      .sort(newestFirst)
    const latest = versions[0] ?? null
    const draft = rows
      .filter((r) => r.contentGoal === kind && versionFor(r, kind) === null)
      .filter((r) => !latest || r.createdAt > latest.createdAt)
      .sort(newestFirst)[0]
    groups[kind] = { latest, earlier: versions.slice(1), draftRowId: draft?.id ?? null }
  }
  return groups
}

export function summarizeProject(groups: Record<AssetKind, AssetGroup>): string {
  const made = ASSET_KINDS.filter((k) => groups[k].latest).map((k) => SHORT_LABELS[k])
  return made.length > 0 ? made.join(' · ') : 'Nothing made yet'
}
```

- [ ] **Step 4: Run to verify pass** — Run: `npm test -- lib/services/ads/projectAssets.test.ts` — Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/services/ads/projectAssets.ts lib/services/ads/projectAssets.test.ts
git commit -m "feat(ads): group a book's creations into A+, video and ad-image rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Merge recent work for the home page (pure)

**Files:**
- Create: `lib/services/shared/recentWork.ts`
- Test: `lib/services/shared/recentWork.test.ts`

**Interfaces:**
- Produces:
  - `interface RecentItem { key: string; kind: 'ads' | 'book'; title: string; coverUrl: string | null; href: string; updatedAt: Date }`
  - `mergeRecentWork(ads: { id: string; title: string; coverUrl: string | null; activityAt: Date }[], books: { id: string; title: string | null; coverImageUrl: string | null; updatedAt: Date | string }[], limit: number): RecentItem[]`

- [ ] **Step 1: Write the failing test**

```ts
// lib/services/shared/recentWork.test.ts
import { describe, it, expect } from 'vitest'
import { mergeRecentWork } from './recentWork'

const d = (day: number) => new Date(Date.UTC(2026, 9, day))

describe('mergeRecentWork', () => {
  it('mixes both tools newest first, links each to its own tool, and caps the list', () => {
    const items = mergeRecentWork(
      [
        { id: 'ad1', title: 'Ads book', coverUrl: 'c.png', activityAt: d(3) },
        { id: 'ad2', title: 'Older ads', coverUrl: null, activityAt: d(1) },
      ],
      [{ id: 'bk1', title: null, coverImageUrl: null, updatedAt: d(2).toISOString() }],
      2
    )
    expect(items).toEqual([
      { key: 'ads:ad1', kind: 'ads', title: 'Ads book', coverUrl: 'c.png', href: '/ads/books/ad1', updatedAt: d(3) },
      { key: 'book:bk1', kind: 'book', title: 'Untitled book', coverUrl: null, href: '/create-book/bk1', updatedAt: d(2) },
    ])
  })
})
```

- [ ] **Step 2: Run to verify failure** — Run: `npm test -- lib/services/shared/recentWork.test.ts` — Expected: FAIL, cannot resolve `./recentWork`.

- [ ] **Step 3: Implement**

```ts
// lib/services/shared/recentWork.ts

/** One "Pick up where you left off" card on the home page, linked to the tool it belongs to. */
export interface RecentItem {
  key: string
  kind: 'ads' | 'book'
  title: string
  coverUrl: string | null
  href: string
  updatedAt: Date
}

export function mergeRecentWork(
  ads: { id: string; title: string; coverUrl: string | null; activityAt: Date }[],
  books: { id: string; title: string | null; coverImageUrl: string | null; updatedAt: Date | string }[],
  limit: number
): RecentItem[] {
  const items: RecentItem[] = [
    ...ads.map((p) => ({
      key: `ads:${p.id}`,
      kind: 'ads' as const,
      title: p.title,
      coverUrl: p.coverUrl,
      href: `/ads/books/${p.id}`,
      updatedAt: p.activityAt,
    })),
    ...books.map((b) => ({
      key: `book:${b.id}`,
      kind: 'book' as const,
      title: b.title || 'Untitled book',
      coverUrl: b.coverImageUrl,
      href: `/create-book/${b.id}`,
      updatedAt: new Date(b.updatedAt),
    })),
  ]
  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, limit)
}
```

- [ ] **Step 4: Run to verify pass** — Run: `npm test -- lib/services/shared/recentWork.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/shared/recentWork.ts lib/services/shared/recentWork.test.ts
git commit -m "feat(home): merge recent ads projects and written books

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Load projects and sync written books (DB)

**Files:**
- Create: `lib/services/ads/projects.ts`
- Test: `lib/services/ads/projects.test.ts` (real test DB, like `lib/services/ads/queries.test.ts`)

**Interfaces:**
- Consumes: Task 1 column; Task 2 `groupProjectAssets`, `summarizeProject`, `ProjectRow`, `AssetGroup`, `AssetKind`; `BookCreatorProjectData` from `lib/services/creator/types.ts`.
- Produces:
  - `projectFieldsFromCreator(creator: BookCreatorProjectData): { title: string; author: string; blurb: string; frontCoverUrl: string | null; interiorImageUrls: string[] }`
  - `syncProjectFromCreator(publisherId: string, creator: BookCreatorProjectData): Promise<Book>`
  - `interface AdsProjectCard { id: string; title: string; author: string; coverUrl: string | null; summary: string; activityAt: Date }`
  - `getAdsProjects(publisherId: string): Promise<AdsProjectCard[]>`
  - `interface AdsProject { root: Book; groups: Record<AssetKind, AssetGroup> }`
  - `getAdsProject(publisherId: string, rootId: string): Promise<AdsProject | null>`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/services/ads/projects.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import type { BookCreatorProjectData } from '@/lib/services/creator/types'
import { getAdsProject, getAdsProjects, projectFieldsFromCreator, syncProjectFromCreator } from './projects'

// Shared test DB, parallel workers: this file only touches its own prefix.
const PREFIX = 'projects_'
const pub = `${PREFIX}pub`
const other = `${PREFIX}other`

afterEach(async () => {
  const mine = { creativeSet: { book: { publisherId: { startsWith: PREFIX } } } }
  await prisma.creativeImage.deleteMany({ where: mine })
  await prisma.creativeSet.deleteMany({ where: { book: { publisherId: { startsWith: PREFIX } } } })
  await prisma.book.deleteMany({ where: { publisherId: { startsWith: PREFIX }, parentBookId: { not: null } } })
  await prisma.book.deleteMany({ where: { publisherId: { startsWith: PREFIX } } })
})

function creator(over: Partial<BookCreatorProjectData> = {}): BookCreatorProjectData {
  return {
    id: `${PREFIX}cp_${Math.random().toString(36).slice(2)}`,
    publisherId: pub,
    title: 'Owl Woods',
    subtitle: null,
    author: 'Eliza',
    bookType: 'children',
    genre: null,
    targetAudience: null,
    styleTheme: null,
    difficultyLevel: null,
    promptConcept: 'A shy owl',
    coverPrompt: null,
    coverImageUrl: 'https://img/cover.png',
    status: 'generated',
    metadata: null,
    content: {
      type: 'children',
      pages: Array.from({ length: 7 }, (_, i) => ({
        pageNumber: i + 1,
        storyText: 't',
        illustrationPrompt: 'p',
        generatedImageUrl: i === 1 ? undefined : `https://img/p${i + 1}.png`,
      })),
    },
    wordCount: 0,
    pageCount: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

describe('projectFieldsFromCreator', () => {
  it('maps title, author, concept and cover, and keeps up to five drawn pages', () => {
    expect(projectFieldsFromCreator(creator())).toEqual({
      title: 'Owl Woods',
      author: 'Eliza',
      blurb: 'A shy owl',
      frontCoverUrl: 'https://img/cover.png',
      interiorImageUrls: ['https://img/p1.png', 'https://img/p3.png', 'https://img/p4.png', 'https://img/p5.png', 'https://img/p6.png'],
    })
  })

  it('has no inside pages for book types without page images', () => {
    const fields = projectFieldsFromCreator(creator({ content: null, title: null, author: null, promptConcept: null }))
    expect(fields).toMatchObject({ title: 'Untitled book', author: '', blurb: '', interiorImageUrls: [] })
  })
})

describe('syncProjectFromCreator', () => {
  it('creates the root once and updates it on later syncs', async () => {
    const cp = creator()
    const first = await syncProjectFromCreator(pub, cp)
    const second = await syncProjectFromCreator(pub, { ...cp, title: 'Owl Woods (2nd ed.)' })

    expect(second.id).toBe(first.id)
    expect(second.title).toBe('Owl Woods (2nd ed.)')
    expect(first).toMatchObject({ publisherId: pub, parentBookId: null, creatorProjectId: cp.id, contentGoal: null })
    expect(await prisma.book.count({ where: { creatorProjectId: cp.id } })).toBe(1)
  })
})

describe('getAdsProjects / getAdsProject', () => {
  async function seedProject(publisherId: string) {
    const root = await prisma.book.create({ data: { publisherId, title: 'RAG', contentGoal: 'all' } })
    const child = await prisma.book.create({ data: { publisherId, title: 'RAG', parentBookId: root.id, contentGoal: 'aplus' } })
    await prisma.creativeSet.create({
      data: { bookId: child.id, images: { create: [{ platform: 'AMAZON', sizeKey: 'amazon_aplus_banner_970x600', width: 970, height: 600, imageUrl: 'hero.png' }] } },
    })
    return { root, child }
  }

  it('returns one card per root with a summary of what exists', async () => {
    const { root } = await seedProject(pub)
    await prisma.book.create({ data: { publisherId: pub, title: 'Empty' } })

    const cards = await getAdsProjects(pub)
    expect(cards.map((c) => c.title).sort()).toEqual(['Empty', 'RAG'])
    expect(cards.find((c) => c.id === root.id)?.summary).toBe('A+ images')
    expect(cards.find((c) => c.title === 'Empty')?.summary).toBe('Nothing made yet')
  })

  it('loads a project with its grouped creations, scoped to the publisher and to roots', async () => {
    const { root, child } = await seedProject(pub)

    const project = await getAdsProject(pub, root.id)
    expect(project?.groups.aplus.latest).toMatchObject({ rowId: child.id, imageUrls: ['hero.png'] })
    expect(await getAdsProject(other, root.id)).toBeNull()
    expect(await getAdsProject(pub, child.id)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure** — Run: `npm test -- lib/services/ads/projects.test.ts` — Expected: FAIL, cannot resolve `./projects`.

- [ ] **Step 3: Implement**

```ts
// lib/services/ads/projects.ts
import { prisma } from '@/lib/db'
import type { Book, Prisma } from '@prisma/client'
import type { BookCreatorProjectData } from '@/lib/services/creator/types'
import { groupProjectAssets, summarizeProject, type AssetGroup, type AssetKind, type ProjectRow } from './projectAssets'

const INTERIOR_IMAGE_LIMIT = 5
// ponytail: newest roots by their own updatedAt; a root whose only recent activity is a
// child can fall past the cap. Touch the root on child changes if this list grows large.
const PROJECT_LIMIT = 60

const ROW_SELECT = {
  id: true,
  parentBookId: true,
  contentGoal: true,
  createdAt: true,
  updatedAt: true,
  creativeSets: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      createdAt: true,
      videoUrl: true,
      videoPosterUrl: true,
      videoDuration: true,
      images: { select: { imageUrl: true, sizeKey: true } },
    },
  },
  aiVideoJobs: {
    where: { status: 'completed', videoUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { videoUrl: true, posterUrl: true, createdAt: true },
  },
} satisfies Prisma.BookSelect

type SelectedRow = Prisma.BookGetPayload<{ select: typeof ROW_SELECT }>

function toProjectRow(r: SelectedRow): ProjectRow {
  return { id: r.id, contentGoal: r.contentGoal, createdAt: r.createdAt, set: r.creativeSets[0] ?? null, aiVideo: r.aiVideoJobs[0] ?? null }
}

export function projectFieldsFromCreator(creator: BookCreatorProjectData) {
  const pages =
    creator.content && (creator.content.type === 'children' || creator.content.type === 'coloring') ? creator.content.pages : []
  return {
    title: creator.title || 'Untitled book',
    author: creator.author || '',
    blurb: creator.promptConcept || '',
    frontCoverUrl: creator.coverImageUrl,
    interiorImageUrls: pages
      .flatMap((p) => (p.generatedImageUrl ? [p.generatedImageUrl] : []))
      .slice(0, INTERIOR_IMAGE_LIMIT),
  }
}

/**
 * The written book's one Ads project, created on first use and refreshed after —
 * so every creation copies the latest cover and pages. Callers must have
 * loaded `creator` scoped to `publisherId`.
 */
export function syncProjectFromCreator(publisherId: string, creator: BookCreatorProjectData): Promise<Book> {
  const fields = projectFieldsFromCreator(creator)
  return prisma.book.upsert({
    where: { creatorProjectId: creator.id },
    update: fields,
    create: { ...fields, publisherId, creatorProjectId: creator.id, contentGoal: null, platforms: ['AMAZON'] },
  })
}

export interface AdsProjectCard {
  id: string
  title: string
  author: string
  coverUrl: string | null
  summary: string
  activityAt: Date
}

export async function getAdsProjects(publisherId: string): Promise<AdsProjectCard[]> {
  const roots = await prisma.book.findMany({
    where: { publisherId, parentBookId: null },
    orderBy: { updatedAt: 'desc' },
    take: PROJECT_LIMIT,
    select: { id: true, title: true, author: true, frontCoverUrl: true },
  })
  if (roots.length === 0) return []

  const ids = roots.map((r) => r.id)
  const rows = await prisma.book.findMany({
    where: { publisherId, OR: [{ id: { in: ids } }, { parentBookId: { in: ids } }] },
    select: ROW_SELECT,
  })
  const byRoot = new Map<string, SelectedRow[]>()
  for (const r of rows) {
    const rootId = r.parentBookId ?? r.id
    byRoot.set(rootId, [...(byRoot.get(rootId) ?? []), r])
  }

  return roots
    .map((root) => {
      const own = byRoot.get(root.id) ?? []
      return {
        id: root.id,
        title: root.title || 'Untitled book',
        author: root.author || '',
        coverUrl: root.frontCoverUrl,
        summary: summarizeProject(groupProjectAssets(own.map(toProjectRow))),
        activityAt: new Date(Math.max(...own.map((r) => r.updatedAt.getTime()))),
      }
    })
    .sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime())
}

export interface AdsProject {
  root: Book
  groups: Record<AssetKind, AssetGroup>
}

/** Null for another publisher's book and for child (creation) rows — only roots are projects. */
export async function getAdsProject(publisherId: string, rootId: string): Promise<AdsProject | null> {
  const root = await prisma.book.findFirst({ where: { id: rootId, publisherId, parentBookId: null } })
  if (!root) return null
  const rows = await prisma.book.findMany({
    where: { publisherId, OR: [{ id: root.id }, { parentBookId: root.id }] },
    select: ROW_SELECT,
  })
  return { root, groups: groupProjectAssets(rows.map(toProjectRow)) }
}
```

- [ ] **Step 4: Run to verify pass** — Run: `npm test -- lib/services/ads/projects.test.ts` — Expected: PASS (5 tests). If the `afterEach` hits a foreign-key error from `aiVideoJob`, add `await prisma.aiVideoJob.deleteMany({ where: { book: { publisherId: { startsWith: PREFIX } } } })` first.

- [ ] **Step 5: Typecheck** — Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/services/ads/projects.ts lib/services/ads/projects.test.ts
git commit -m "feat(ads): load book projects and sync a written book's project

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: "Promote this book" route replaces send-to-ads

**Files:**
- Create: `app/api/creator/projects/[id]/promote/route.ts`
- Test: `app/api/creator/projects/[id]/promote/route.test.ts`
- Delete: `app/api/creator/projects/[id]/send-to-ads/route.ts`
- Modify: `app/api/creator/projects/route.test.ts` (remove the send-to-ads import at line 10 and the `it('POST /api/creator/projects/[id]/send-to-ads bridges book into ads studio', …)` case starting at line 245; remove `book: { create: vi.fn() }` from its prisma mock if nothing else uses it)

**Interfaces:**
- Consumes: `syncProjectFromCreator` (Task 4); `getCreatorProjectForPublisher(publisherId, id)` from `lib/services/creator/queries.ts`.
- Produces: `POST /api/creator/projects/[id]/promote` → `200 { projectUrl: '/ads/books/<rootId>' }` | `404 { error }`.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/creator/projects/[id]/promote/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/providers/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/services/creator/queries', () => ({ getCreatorProjectForPublisher: vi.fn() }))
vi.mock('@/lib/services/ads/projects', () => ({ syncProjectFromCreator: vi.fn() }))

import { POST } from './route'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'
import { syncProjectFromCreator } from '@/lib/services/ads/projects'

const call = () => POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'cp_1' }) })

describe('POST /api/creator/projects/[id]/promote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the book’s Ads project page', async () => {
    const project = { id: 'cp_1', title: 'Owl' }
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValue(project as never)
    vi.mocked(syncProjectFromCreator).mockResolvedValue({ id: 'root_1' } as never)

    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ projectUrl: '/ads/books/root_1' })
    expect(getCreatorProjectForPublisher).toHaveBeenCalledWith('pub_1', 'cp_1')
    expect(syncProjectFromCreator).toHaveBeenCalledWith('pub_1', project)
  })

  it('404s for a book the publisher does not own', async () => {
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValue(null)
    const res = await call()
    expect(res.status).toBe(404)
    expect(syncProjectFromCreator).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure** — Run: `npm test -- "app/api/creator/projects/\[id\]/promote"` — Expected: FAIL, cannot resolve `./route`.

- [ ] **Step 3: Implement**

```ts
// app/api/creator/projects/[id]/promote/route.ts
import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'
import { syncProjectFromCreator } from '@/lib/services/ads/projects'

export const dynamic = 'force-dynamic'

/** Opens (creating on first use) the written book's one Ads project. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getCreatorProjectForPublisher(publisherId, id)
  if (!project) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const root = await syncProjectFromCreator(publisherId, project)
  return NextResponse.json({ projectUrl: `/ads/books/${root.id}` })
}
```

- [ ] **Step 4: Delete send-to-ads** — `git rm "app/api/creator/projects/[id]/send-to-ads/route.ts"`, then edit `app/api/creator/projects/route.test.ts` as listed under Files.

- [ ] **Step 5: Run to verify pass** — Run: `npm test -- app/api/creator` — Expected: PASS; no reference to `send-to-ads` remains (`grep -rn "send-to-ads" app components lib` prints nothing except `BookProjectStudio.tsx`, fixed in Task 10).

- [ ] **Step 6: Commit**

```bash
git add -A "app/api/creator/projects"
git commit -m "feat(creator): promote a written book into its one ads project

Replaces send-to-ads, which created a new ads row on every click.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Creations from a written book copy its latest cover and pages

**Files:**
- Modify: `app/api/ads/projects/route.ts` (JSON `existingBookId` branch, ~lines 41-75)
- Test: `app/api/ads/projects/route.test.ts`

**Interfaces:**
- Consumes: `syncProjectFromCreator` (Task 4), `getCreatorProjectForPublisher`.

- [ ] **Step 1: Write the failing test** — add these mocks next to the existing `vi.mock` calls at the top of `app/api/ads/projects/route.test.ts`:

```ts
vi.mock('@/lib/services/creator/queries', () => ({ getCreatorProjectForPublisher: vi.fn() }))
vi.mock('@/lib/services/ads/projects', () => ({ syncProjectFromCreator: vi.fn() }))
```

and this case inside `describe('POST /api/ads/projects', …)`:

```ts
  it('refreshes a written book’s project before copying it into a new creation', async () => {
    const { getCreatorProjectForPublisher } = await import('@/lib/services/creator/queries')
    const { syncProjectFromCreator } = await import('@/lib/services/ads/projects')
    vi.mocked(prisma.book.findFirst).mockResolvedValueOnce({
      id: 'root_1', parentBookId: null, creatorProjectId: 'cp_1', title: 'Stale', frontCoverUrl: null,
      interiorImageUrls: [], platforms: ['AMAZON'], contentGoal: null,
    } as never)
    vi.mocked(getCreatorProjectForPublisher).mockResolvedValueOnce({ id: 'cp_1' } as never)
    vi.mocked(syncProjectFromCreator).mockResolvedValueOnce({
      id: 'root_1', parentBookId: null, creatorProjectId: 'cp_1', title: 'Fresh', author: 'Eliza', blurb: '',
      pdfUrl: null, frontCoverUrl: 'https://img/cover.png', backCoverUrl: null, sourceUrl: null,
      interiorImageUrls: ['https://img/p1.png'], platforms: ['AMAZON'], contentGoal: null,
      templateKey: 'classic', copyTone: 'literary',
    } as never)

    const res = await POST(
      new Request('http://localhost/api/ads/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingBookId: 'root_1', contentGoal: 'aplus' }),
      })
    )

    expect(res.status).toBe(201)
    expect(getCreatorProjectForPublisher).toHaveBeenCalledWith('pub_1', 'cp_1')
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Fresh',
          frontCoverUrl: 'https://img/cover.png',
          interiorImageUrls: ['https://img/p1.png'],
          parentBookId: 'root_1',
          contentGoal: 'aplus',
        }),
      })
    )
  })
```

- [ ] **Step 2: Run to verify failure** — Run: `npm test -- app/api/ads/projects/route.test.ts` — Expected: the new case FAILS (title `'Stale'`, cover `null`).

- [ ] **Step 3: Implement** — add imports at the top of `app/api/ads/projects/route.ts`:

```ts
import { getCreatorProjectForPublisher } from '@/lib/services/creator/queries'
import { syncProjectFromCreator } from '@/lib/services/ads/projects'
```

and in the JSON `if (existingBookId) {` branch replace the lookup with:

```ts
      let sourceBook = await prisma.book.findFirst({
        where: { id: existingBookId, publisherId },
      })
      if (!sourceBook) {
        return NextResponse.json({ error: 'Selected book not found' }, { status: 404 })
      }
      // A written book's project copies whatever cover and pages it has right now.
      if (sourceBook.creatorProjectId) {
        const creator = await getCreatorProjectForPublisher(publisherId, sourceBook.creatorProjectId)
        if (creator) sourceBook = await syncProjectFromCreator(publisherId, creator)
      }
```

(The rest of the branch is unchanged.)

- [ ] **Step 4: Run to verify pass** — Run: `npm test -- app/api/ads/projects/route.test.ts` — Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add app/api/ads/projects/route.ts app/api/ads/projects/route.test.ts
git commit -m "feat(ads): new creations from a written book use its latest cover and pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `/ads` becomes "Your books"; rail removed; back link on creation pages

**Files:**
- Modify: `app/(platform)/ads/layout.tsx`
- Modify: `app/(platform)/ads/page.tsx`
- Modify: `app/(platform)/ads/[projectId]/layout.tsx`
- Modify: `app/(platform)/ads/[projectId]/upload/page.tsx`, `components/ads/DetailsReview.tsx`

**Interfaces:**
- Consumes: `getAdsProjects` (Task 4).
- Produces: `DetailsReview` gains required prop `nextHref: string`.

- [ ] **Step 1: Replace `app/(platform)/ads/layout.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { title: { default: 'Ads Creative', template: '%s · Ads Creative' } }

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-10">{children}</div>
}
```

- [ ] **Step 2: Replace `app/(platform)/ads/page.tsx`**

```tsx
import Link from 'next/link'
import { BookImage, Megaphone, Plus } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAdsProjects } from '@/lib/services/ads/projects'
import { EmptyState } from '@/components/platform/EmptyState'
import { buttonClasses } from '@/components/ui/button'
import { timeAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AdsHomePage() {
  const publisherId = await requireCurrentPublisherId()
  const projects = await getAdsProjects(publisherId)
  const addButton = (
    <Link href="/ads/new" className={buttonClasses({ size: 'lg' })}>
      <Plus className="size-4" aria-hidden /> Add a book
    </Link>
  )

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Ads Creative</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your books</h1>
          <p className="mt-2 text-ink-muted">Open a book to make A+ images, a video ad or ad images for it.</p>
        </div>
        {projects.length > 0 && addButton}
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-7" aria-hidden />}
          title="Add your first book"
          description="Paste a store link or upload a cover. Then make A+ images, a video ad or ad images for it."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/ads/books/${p.id}`}
                className="flex h-full gap-4 rounded-card bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="grid aspect-[3/4] w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 shadow-inset">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <BookImage className="size-5 text-ink-muted" aria-hidden />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium">{p.title}</span>
                  {p.author && <span className="truncate text-sm text-ink-muted">{p.author}</span>}
                  <span className="mt-auto text-xs text-ink-muted">{p.summary}</span>
                  <span className="text-xs text-ink-muted">{timeAgo(p.activityAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Back link in `app/(platform)/ads/[projectId]/layout.tsx`** — remove the `Plus` and `buttonClasses` imports and the `<Link href="/ads/new" …>Another campaign</Link>` element; add `ArrowLeft` to the `lucide-react` import; make the returned JSX start with the back link:

```tsx
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/ads/books/${book.parentBookId ?? book.id}`}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> {book.title || 'Untitled book'}
      </Link>
      <header className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-card sm:p-6">
        {/* …existing header content, minus "Another campaign"… */}
      </header>
      {children}
    </div>
  )
```

- [ ] **Step 4: Upload page continues to the right place** — in `components/ads/DetailsReview.tsx` add `nextHref: string` to the props type and destructuring, and replace `router.push(\`/ads/${projectId}/configure\`)` with `router.push(nextHref)`. In `app/(platform)/ads/[projectId]/upload/page.tsx` pass:

```tsx
      // A book being added (a root) goes to its project page; a creation goes on to configure.
      nextHref={book.parentBookId ? `/ads/${book.id}/configure` : `/ads/books/${book.id}`}
```

- [ ] **Step 5: Typecheck** — Run: `npx tsc --noEmit` — Expected: no errors. (`/ads/books/[id]` 404s until Task 8.)

- [ ] **Step 6: Commit**

```bash
git add "app/(platform)/ads/layout.tsx" "app/(platform)/ads/page.tsx" "app/(platform)/ads/[projectId]/layout.tsx" "app/(platform)/ads/[projectId]/upload/page.tsx" components/ads/DetailsReview.tsx
git commit -m "feat(ads): Your books grid replaces the campaign rail

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Project page `/ads/books/[id]`

**Files:**
- Create: `app/(platform)/ads/books/[id]/page.tsx`
- Create: `components/ads/CreateAssetButton.tsx`
- Create: `components/ads/EditBookDetails.tsx`

**Interfaces:**
- Consumes: `getAdsProject` (Task 4); `ASSET_KINDS`, `ASSET_LABELS`, `AssetGroup`, `AssetKind`, `AssetVersion` (Task 2); `getBookForPublisher` from `lib/services/ads/queries.ts`; `goalCreditLabel(goal: 'aplus' | 'sponsored' | 'video'): string` from `lib/credits/prices.ts`; existing `POST /api/ads/projects` (JSON `{ existingBookId, contentGoal, campaignName }` → `201 { id }`) and `PATCH /api/ads/projects/[id]` (JSON `{ title, author }`).

- [ ] **Step 1: `components/ads/CreateAssetButton.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ASSET_LABELS, type AssetKind } from '@/lib/services/ads/projectAssets'

/** Starts one creation for the book, then hands off to its settings page. */
export function CreateAssetButton({ rootId, kind, label }: { rootId: string; kind: AssetKind; label: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onClick() {
    setPending(true)
    const res = await fetch('/api/ads/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ existingBookId: rootId, contentGoal: kind, campaignName: ASSET_LABELS[kind] }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      toast.error(json.error ?? 'We couldn’t start that. Please try again.')
      return
    }
    router.push(`/ads/${json.id}/configure`)
  }

  return (
    <Button size="sm" loading={pending} onClick={onClick}>
      {label}
    </Button>
  )
}
```

- [ ] **Step 2: `components/ads/EditBookDetails.tsx`**

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function EditBookDetails({ rootId, title, author }: { rootId: string; title: string; author: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [values, setValues] = useState({ title, author })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    const res = await fetch(`/api/ads/projects/${rootId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: values.title.trim(), author: values.author.trim() }),
    })
    setPending(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'We couldn’t save those details.')
      return
    }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit details
      </Button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          className="rounded-xl border border-line bg-surface px-3 py-2"
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Author
        <input
          className="rounded-xl border border-line bg-surface px-3 py-2"
          value={values.author}
          onChange={(e) => setValues((v) => ({ ...v, author: e.target.value }))}
        />
      </label>
      <Button type="submit" size="sm" loading={pending}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: `app/(platform)/ads/books/[id]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BookImage, Film } from 'lucide-react'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAdsProject } from '@/lib/services/ads/projects'
import { getBookForPublisher } from '@/lib/services/ads/queries'
import { ASSET_KINDS, ASSET_LABELS, type AssetGroup, type AssetKind, type AssetVersion } from '@/lib/services/ads/projectAssets'
import { goalCreditLabel } from '@/lib/credits/prices'
import { timeAgo } from '@/lib/format'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CreateAssetButton } from '@/components/ads/CreateAssetButton'
import { EditBookDetails } from '@/components/ads/EditBookDetails'

export const dynamic = 'force-dynamic'

export default async function AdsBookProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const project = await getAdsProject(publisherId, id)
  if (!project) {
    // Old links point at a creation; send them to its book.
    const book = await getBookForPublisher(publisherId, id)
    if (book?.parentBookId) redirect(`/ads/books/${book.parentBookId}`)
    notFound()
  }
  const { root, groups } = project

  return (
    <div className="flex flex-col gap-6">
      <Link href="/ads" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Your books
      </Link>

      <header className="flex flex-wrap items-center gap-5">
        <span className="grid aspect-[3/4] w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 shadow-inset">
          {root.frontCoverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={root.frontCoverUrl} alt={`Cover of ${root.title ?? 'this book'}`} className="size-full object-cover" />
          ) : (
            <BookImage className="size-6 text-ink-muted" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{root.title || 'Untitled book'}</h1>
          {root.author && <p className="mt-1 text-ink-muted">{root.author}</p>}
          <div className="mt-2">
            {root.creatorProjectId ? (
              <Link href={`/create-book/${root.creatorProjectId}`} className="text-sm font-medium text-accent hover:underline">
                Written in Create a book — Open book
              </Link>
            ) : (
              <EditBookDetails rootId={root.id} title={root.title ?? ''} author={root.author ?? ''} />
            )}
          </div>
        </div>
      </header>

      <section aria-labelledby="make-heading">
        <h2 id="make-heading" className="font-display text-xl font-semibold">What do you want to make?</h2>
        <Card className="mt-4 divide-y divide-line">
          <ul className="divide-y divide-line">
            {ASSET_KINDS.map((kind) => (
              <AssetRow key={kind} rootId={root.id} kind={kind} group={groups[kind]} />
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}

function AssetRow({ rootId, kind, group }: { rootId: string; kind: AssetKind; group: AssetGroup }) {
  const { latest, earlier, draftRowId } = group
  return (
    <li className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="min-w-0 sm:w-52">
        <h3 className="font-medium">{ASSET_LABELS[kind]}</h3>
        <p className="text-sm text-ink-muted">
          {latest ? `Made ${timeAgo(latest.createdAt)}` : `Not made yet · ${goalCreditLabel(kind)}`}
        </p>
      </div>
      <div className="flex flex-1 gap-2">{latest && <Preview version={latest} />}</div>
      <div className="flex flex-wrap items-center gap-2">
        {latest && (
          <Link href={`/ads/${latest.rowId}/results`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
            View
          </Link>
        )}
        {/* One unfinished item at a time: finish it rather than starting another. */}
        {draftRowId ? (
          <Link href={`/ads/${draftRowId}`} className={buttonClasses({ size: 'sm' })}>
            Continue unfinished
          </Link>
        ) : (
          <CreateAssetButton rootId={rootId} kind={kind} label={latest ? 'Create new' : 'Create'} />
        )}
      </div>
      {earlier.length > 0 && (
        <details className="text-sm text-ink-muted sm:basis-full">
          <summary className="cursor-pointer">
            {earlier.length} earlier {earlier.length === 1 ? 'version' : 'versions'}
          </summary>
          <ul className="mt-2 flex flex-wrap gap-3">
            {earlier.map((v) => (
              <li key={`${v.rowId}-${v.createdAt.getTime()}`}>
                <Link href={`/ads/${v.rowId}/results`} className="text-accent hover:underline">
                  {timeAgo(v.createdAt)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

function Preview({ version }: { version: AssetVersion }) {
  if (version.videoUrl) {
    return (
      <span className="relative grid h-16 w-28 place-items-center overflow-hidden rounded-lg bg-surface-2 shadow-inset">
        {version.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={version.posterUrl} alt="" className="size-full object-cover" />
        ) : (
          <Film className="size-5 text-ink-muted" aria-hidden />
        )}
        {version.durationSec && (
          <span className="absolute bottom-1 right-1 rounded bg-ink/70 px-1 text-[10px] text-canvas">0:{String(version.durationSec).padStart(2, '0')}</span>
        )}
      </span>
    )
  }
  return (
    <>
      {version.imageUrls.slice(0, 3).map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt="" className="h-16 w-auto rounded-lg object-cover shadow-subtle" />
      ))}
    </>
  )
}
```

- [ ] **Step 4: Typecheck** — Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 5: Look at it** — with the dev server running (`npm run dev`), open `/ads`, click a book, confirm the three rows render, *View* opens results, *Create* lands on `/ads/<new>/configure`, and the configure page's back link returns to the book. Open `/ads/books/<a child id>` and confirm it redirects to the book. Screenshot the project page and look at it.

- [ ] **Step 6: Commit**

```bash
git add "app/(platform)/ads/books" components/ads/CreateAssetButton.tsx components/ads/EditBookDetails.tsx
git commit -m "feat(ads): book project page with A+, video and ad-image rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `/ads/new` — Add a book

**Files:**
- Create: `components/ads/AddBookForm.tsx`
- Modify: `app/(platform)/ads/new/page.tsx`
- Delete: `components/ads/NewProjectForm.tsx` (only `app/(platform)/ads/new/page.tsx` imports it); `app/api/ads/library/route.ts` and `getPublisherBookLibrary` in `lib/services/ads/queries.ts` if `grep -rn "getPublisherBookLibrary\|api/ads/library" app components lib` shows no other user after this task.

**Interfaces:**
- Consumes: `POST /api/extract-url` (JSON `{ url }` → `{ title, author, blurb, coverUrl, sourceUrl, rating?, reviewCount? }`); `POST /api/ads/projects` (JSON or multipart; → `201 { id, needsManualCover? }`); `Dropzone({ id, label, rule, file, onFileChange, compact? })`; `COVER_RULE`, `PDF_RULE` from `lib/services/shared/upload`.

- [ ] **Step 1: `components/ads/AddBookForm.tsx`**

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/components/ui/cn'
import { Dropzone } from '@/components/platform/Dropzone'
import { COVER_RULE, PDF_RULE } from '@/lib/services/shared/upload'

type Mode = 'link' | 'upload' | 'pdf'

interface Extracted {
  title: string
  author: string
  blurb: string
  coverUrl: string | null
  sourceUrl: string
  rating?: number | null
  reviewCount?: number | null
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'link', label: 'Paste a store link' },
  { key: 'upload', label: 'Upload a cover' },
  { key: 'pdf', label: 'Upload a PDF' },
]

const inputClass = 'w-full rounded-xl border border-line bg-surface px-3 py-2.5'

export function AddBookForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('link')
  const [url, setUrl] = useState('')
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function getDetails() {
    if (!url.trim()) return setError('Paste a link to your book first.')
    setPending(true)
    setError(null)
    const res = await fetch('/api/extract-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    setPending(false)
    if (!res.ok) return setError(json.error ?? 'We couldn’t read that link. Try uploading a cover instead.')
    setExtracted(json)
    setTitle(json.title ?? '')
    setAuthor(json.author ?? '')
  }

  async function create(body: BodyInit, isJson: boolean) {
    setPending(true)
    setError(null)
    const res = await fetch('/api/ads/projects', {
      method: 'POST',
      body,
      headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPending(false)
      return setError(json.error ?? 'Something went wrong adding your book.')
    }
    router.push(json.needsManualCover ? `/ads/${json.id}/upload` : `/ads/books/${json.id}`)
    router.refresh()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'link') {
      if (!extracted) return void getDetails()
      return void create(
        JSON.stringify({
          title: title.trim() || extracted.title,
          author: author.trim(),
          blurb: extracted.blurb,
          frontCoverUrl: extracted.coverUrl,
          sourceUrl: extracted.sourceUrl,
          rating: extracted.rating ?? null,
          reviewCount: extracted.reviewCount ?? null,
        }),
        true
      )
    }
    if (mode === 'upload') {
      if (!cover || !title.trim()) return setError('Add a cover image and the book title.')
      const form = new FormData()
      form.append('title', title.trim())
      form.append('author', author.trim())
      form.append('frontCover', cover)
      return void create(form, false)
    }
    if (!pdf) return setError('Choose your book PDF.')
    const form = new FormData()
    form.append('pdf', pdf)
    void create(form, false)
  }

  const showDetails = mode === 'upload' || (mode === 'link' && extracted)

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <div role="tablist" aria-label="How to add your book" className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => {
                setMode(m.key)
                setError(null)
              }}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                mode === m.key ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-muted hover:text-ink'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'link' && (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Amazon or Goodreads link
            <input
              className={inputClass}
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setExtracted(null)
              }}
              placeholder="https://www.amazon.com/dp/…"
            />
          </label>
        )}

        {mode === 'link' && extracted?.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={extracted.coverUrl} alt="Cover found at that link" className="h-40 w-auto self-start rounded-lg shadow-card" />
        )}

        {mode === 'upload' && (
          <Dropzone id="frontCover" label="Cover image" rule={COVER_RULE} file={cover} onFileChange={setCover} compact />
        )}

        {showDetails && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Book title
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Author
              <input className={inputClass} value={author} onChange={(e) => setAuthor(e.target.value)} />
            </label>
          </div>
        )}

        {mode === 'pdf' && <Dropzone id="pdf" label="Book PDF" rule={PDF_RULE} file={pdf} onFileChange={setPdf} />}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={pending} className="self-start">
          {mode === 'link' && !extracted ? 'Get details' : 'Add this book'}
        </Button>
      </form>
    </Card>
  )
}
```

- [ ] **Step 2: Replace `app/(platform)/ads/new/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AddBookForm } from '@/components/ads/AddBookForm'

export const metadata: Metadata = { title: 'Add a book' }

export default function AddBookPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link href="/ads" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Your books
      </Link>
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Add a book</h1>
        <p className="mt-2 text-ink-muted">We’ll use its cover and details to make your A+ images, video and ad images.</p>
      </header>
      <AddBookForm />
    </div>
  )
}
```

- [ ] **Step 3: Delete the old form and dead library code** — `git rm components/ads/NewProjectForm.tsx`; run `grep -rn "NewProjectForm\|CONTENT_GOALS\|LibraryBookItem\|getPublisherBookLibrary\|api/ads/library" app components lib e2e`. Remove `app/api/ads/library/route.ts` and `getPublisherBookLibrary` (plus its now-unused imports in `lib/services/ads/queries.ts`) only if nothing else references them.

- [ ] **Step 4: Typecheck and test** — Run: `npx tsc --noEmit && npm test` — Expected: no type errors; all tests pass.

- [ ] **Step 5: Look at it** — open `/ads/new`; try each of the three tabs; add a book by uploading `e2e/fixtures/cover.png` with a title; confirm you land on its project page. Screenshot and look.

- [ ] **Step 6: Commit**

```bash
git add -A components/ads "app/(platform)/ads/new" app/api/ads lib/services/ads/queries.ts
git commit -m "feat(ads): Add a book replaces the long new-campaign form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Book studio — "Promote this book"

**Files:**
- Modify: `components/creator/BookProjectStudio.tsx` (state at line 34, `handleSendToAds` at ~117-136, button at ~286-306)

**Interfaces:**
- Consumes: `POST /api/creator/projects/[id]/promote` → `{ projectUrl }` (Task 5).

- [ ] **Step 1: Replace the handler** — rename state `sendingToAds`/`setSendingToAds` to `promoting`/`setPromoting` and replace `handleSendToAds` with:

```tsx
  async function handlePromote() {
    setPromoting(true)
    try {
      const res = await fetch(`/api/creator/projects/${project.id}/promote`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not open Ads Creative')
      router.push(data.projectUrl)
    } catch (err) {
      toast.error('Could not open Ads Creative', { description: err instanceof Error ? err.message : undefined })
      setPromoting(false)
    }
  }
```

- [ ] **Step 2: Replace the button** — the `{/* 5. CREATE AMAZON ADS */}` `<Button …>` block becomes:

```tsx
          {/* Secondary on purpose: it leaves this tool for Ads Creative. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={promoting}
            onClick={handlePromote}
            title="Opens this book in Ads Creative to make A+ images, a video ad or ad images"
          >
            <Megaphone className="size-4" /> Promote this book
          </Button>
```

- [ ] **Step 3: Typecheck** — Run: `npx tsc --noEmit` — Expected: no errors; `grep -rn "send-to-ads\|sendingToAds" components app lib` prints nothing.

- [ ] **Step 4: Look at it** — open a written book at `/create-book/<id>`; click *Promote this book* twice (back button between); both land on the same `/ads/books/<rootId>`; *Open book* link there returns to the book.

- [ ] **Step 5: Commit**

```bash
git add components/creator/BookProjectStudio.tsx
git commit -m "feat(creator): Promote this book opens the book's one ads project

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Home "Pick up where you left off" links each card to its own tool

**Files:**
- Modify: `app/(platform)/page.tsx`
- Modify: `lib/services/ads/queries.ts` (delete `RAIL_SELECT`, `RailBook`, `getRecentBooksForPublisher`), `lib/services/ads/queries.test.ts` (first test)

**Interfaces:**
- Consumes: `getAdsProjects` (Task 4), `getCreatorProjectsForPublisher` (`lib/services/creator/queries.ts`), `mergeRecentWork`, `RecentItem` (Task 3).

- [ ] **Step 1: Rewrite the recent section of `app/(platform)/page.tsx`** — imports become:

```tsx
import Link from 'next/link'
import { BookImage } from 'lucide-react'
import { SERVICES } from '@/lib/services/registry'
import { requireCurrentPublisherId } from '@/lib/providers/auth'
import { getAdsProjects } from '@/lib/services/ads/projects'
import { getCreatorProjectsForPublisher } from '@/lib/services/creator/queries'
import { mergeRecentWork } from '@/lib/services/shared/recentWork'
import { timeAgo } from '@/lib/format'
import { ServiceCard } from '@/components/platform/ServiceCard'
```

data loading becomes:

```tsx
  const publisherId = await requireCurrentPublisherId()
  const [adsProjects, books] = await Promise.all([getAdsProjects(publisherId), getCreatorProjectsForPublisher(publisherId)])
  const recent = mergeRecentWork(adsProjects, books, 4)
```

and the card body (inside `recent.map((p) => …)`, with `key={p.key}` and `href={p.href}`) becomes:

```tsx
                <li key={p.key}>
                  <Link
                    href={p.href}
                    className="flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <span className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-surface-2 shadow-inset">
                      {p.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
                      ) : (
                        <BookImage className="size-8 text-ink-muted" aria-hidden />
                      )}
                    </span>
                    <span className="flex flex-col gap-2 p-4">
                      <span className="text-xs font-medium text-accent">{p.kind === 'ads' ? 'Ads Creative' : 'Create Your Book'}</span>
                      <span className="truncate font-medium">{p.title}</span>
                      <span className="text-xs text-ink-muted">{timeAgo(p.updatedAt)}</span>
                    </span>
                  </Link>
                </li>
```

(The header and tool cards above it are unchanged; remove the now-unused `Badge` and `statusDisplay` imports.)

- [ ] **Step 2: Delete the rail query** — remove `RAIL_SELECT`, `RailBook` and `getRecentBooksForPublisher` from `lib/services/ads/queries.ts` (confirm with `grep -rn "getRecentBooksForPublisher\|RAIL_SELECT\|RailBook" app components lib` → only the test). In `lib/services/ads/queries.test.ts`, drop it from the import and change the first test to keep checking isolation:

```ts
  it('only returns books belonging to the given publisher', async () => {
    const bookA = await prisma.book.create({ data: { publisherId: pubA, pdfUrl: 'x' } })
    const bookB = await prisma.book.create({ data: { publisherId: pubB, pdfUrl: 'y' } })

    expect(await getBookForPublisher(pubA, bookA.id)).not.toBeNull()
    expect(await getBookForPublisher(pubA, bookB.id)).toBeNull()
  })
```

- [ ] **Step 3: Typecheck and test** — Run: `npx tsc --noEmit && npm test` — Expected: no errors; all tests pass.

- [ ] **Step 4: Look at it** — open `/`; recent cards show both tools' items; a written book's card opens `/create-book/<id>`, an ads card opens `/ads/books/<id>`.

- [ ] **Step 5: Commit**

```bash
git add "app/(platform)/page.tsx" lib/services/ads/queries.ts lib/services/ads/queries.test.ts
git commit -m "fix(home): recent work links books to the book tool, not to ads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: End-to-end coverage and full verification

**Files:**
- Modify: `e2e/ads.spec.ts` (replace the first test; keep the designed-states test)
- Check: `e2e/ads-instant-video.spec.ts`, `e2e/ads-ai-video.spec.ts`, `e2e/credits.spec.ts` — update any step that goes through `/ads/new`'s old form or the removed rail.

- [ ] **Step 1: Replace the first test in `e2e/ads.spec.ts`**

```ts
test('add a book, make ad images, and find them on the book page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Local mode')).toBeVisible()
  await page.getByRole('link', { name: /Ads Creative/ }).first().click()
  await expect(page).toHaveURL(/\/ads$/)
  await expect(page.getByRole('heading', { name: 'Your books' })).toBeVisible()

  // Add a book by cover upload
  await page.getByRole('link', { name: 'Add a book' }).first().click()
  await page.getByRole('tab', { name: 'Upload a cover' }).click()
  await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  await page.getByLabel('Book title').fill('The Lazy Developer')
  await page.getByLabel('Author').fill('Jane Coder')
  await page.getByRole('button', { name: 'Add this book' }).click()

  // Project page: three rows, nothing made yet
  await expect(page).toHaveURL(/\/ads\/books\/[^/]+$/)
  const bookUrl = page.url()
  await expect(page.getByRole('heading', { name: 'The Lazy Developer' })).toBeVisible()
  for (const row of ['A+ images for Amazon', 'Video ad', 'Ad images']) {
    await expect(page.getByRole('heading', { name: row })).toBeVisible()
  }
  await shot(page, 'book-project-empty')

  // Make ad images only
  const adRow = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Ad images' }) })
  await adRow.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/ads\/[^/]+\/configure$/)
  await page.getByRole('button', { name: /Generate Image Ads/ }).click()
  await expect(page).toHaveURL(/\/results$/, { timeout: 120_000 })
  await expect(page.getByRole('img', { name: /Amazon ad, 300×250/ }).first()).toBeVisible()

  // Back to the book: the ad images are saved in their row, other rows untouched
  await page.getByRole('link', { name: 'The Lazy Developer' }).first().click()
  await expect(page).toHaveURL(bookUrl)
  await expect(adRow.getByRole('link', { name: 'View' })).toBeVisible()
  await expect(adRow.getByRole('button', { name: 'Create new' })).toBeVisible()
  const aplusRow = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'A+ images for Amazon' }) })
  await expect(aplusRow.getByText(/Not made yet/)).toBeVisible()
  await shot(page, 'book-project-with-ads')

  // The grid shows one card for this book, summarising what exists
  await page.getByRole('link', { name: 'Your books' }).click()
  await expect(page.getByRole('link', { name: /The Lazy Developer/ }).first()).toContainText('Ad images')

  // Home: the recent card opens the book's project page
  await page.goto('/')
  await page.getByRole('link', { name: /The Lazy Developer/ }).first().click()
  await expect(page).toHaveURL(bookUrl)
})
```

- [ ] **Step 2: Fix the other specs** — for each of `e2e/ads-instant-video.spec.ts`, `e2e/ads-ai-video.spec.ts`, `e2e/credits.spec.ts`: where a test creates a project through the old `/ads/new` form, replace that part with the steps above (Add a book → upload cover → *Create* in the needed row). For video, the row is `Video ad` and the configure button is `/Generate Video Trailer/`. Results-page assertions stay as they are.

- [ ] **Step 3: Run everything** — stop any dev server on the e2e port first (see `docs/FOLLOWUPS.md`), then run:

Run: `npx tsc --noEmit && npm test && npm run test:e2e`
Expected: typecheck clean; all unit tests pass; all e2e specs pass. Look at `test-results/screens/book-project-empty.png` and `book-project-with-ads.png`.

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test(e2e): add a book, make ad images, find them on the book page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
