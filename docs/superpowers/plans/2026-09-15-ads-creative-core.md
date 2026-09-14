# Ads Creative Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publishers can sign up, upload a book (PDF + optional covers), and generate a set of platform-sized ad images with AI-written copy that they can view and download.

**Architecture:** Single Next.js (App Router) app on Vercel. Server Actions/Route Handlers do all work synchronously within a request — no queue/worker. Clerk for auth, Postgres (via Prisma) for data, Vercel Blob for files, Claude (via Vercel AI SDK) for ad copy, `next/og`'s `ImageResponse` for template-based image compositing.

**Tech Stack:** Next.js (App Router, TypeScript), Clerk, Prisma + Postgres, Vercel Blob, Vercel AI SDK (`generateText`/`Output.object`) routed through the Vercel AI Gateway, `pdfjs-dist` + `@napi-rs/canvas` for PDF extraction, `next/og` for image rendering, Vitest for unit/integration tests, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-09-15-ads-creative-service-design.md`

**Not in this plan:** Meta/Google/Amazon OAuth and direct campaign push (spec's "Ads connectors" component) — that is a separate follow-up plan, built once this pipeline works end-to-end. This plan ends with publishers being able to generate and **download** creatives.

## Global Constraints

- Multi-tenant: every Book/CreativeSet query MUST be scoped to the current publisher (Clerk user id). No cross-publisher data access.
- Image sizes per platform (from spec): Meta feed 1080×1080, Meta story 1080×1920, Google display 300×250 and 728×90, Amazon 300×250.
- If PDF cover/metadata extraction fails, the flow must not fail outright — fall back to manual cover upload.
- If ad copy generation fails after one retry, the creative set is still created with blank/editable copy — never fail the whole generation request because of copy generation alone.
- v1 generation is synchronous (single request) — no background jobs.

---

## File Structure

```
prisma/schema.prisma              # Book, CreativeSet, AdCopy, CreativeImage models
lib/db.ts                         # Prisma client singleton
lib/auth.ts                       # requireCurrentPublisherId()
lib/blob.ts                       # uploadToBlob()
lib/pdf/extract.ts                # extractBookAssets()
lib/pdf/extract.test.ts
lib/ai/generateAdCopy.ts          # generateAdCopy()
lib/ai/generateAdCopy.test.ts
lib/templates/specs.ts            # CREATIVE_SIZES, AdPlatform type
lib/templates/CreativeTemplate.tsx        # shared JSX template component
lib/compositing/renderCreativeImages.tsx  # renderCreativeImages()
lib/compositing/renderCreativeImages.test.ts
app/api/books/route.ts                    # POST create book
app/api/books/route.test.ts
app/api/books/[id]/generate/route.ts      # POST generate creative set
app/api/books/[id]/generate/route.test.ts
app/dashboard/page.tsx                    # book list
app/dashboard/books/new/page.tsx          # upload form
app/dashboard/books/[id]/page.tsx         # book detail + generate + creative set + download
middleware.ts                             # Clerk route protection
e2e/generate-creatives.spec.ts            # Playwright e2e
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `.env.example`, `vitest.config.ts`

**Interfaces:**
- Produces: a running Next.js App Router project (`npm run dev`, `npm run build`, `npm run test` all work) that later tasks add to.

- [ ] **Step 1: Initialize package.json and install core dependencies**

```bash
npm init -y
npm install next@latest react@latest react-dom@latest
npm install -D typescript@latest @types/react@latest @types/node@latest @types/react-dom@latest
npm install -D vitest@latest @vitejs/plugin-react@latest
npm install -D tailwindcss@latest @tailwindcss/postcss@latest
```

- [ ] **Step 2: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`**

```ts
// next.config.ts
import type { NextConfig } from 'next'
const config: NextConfig = {}
export default config
```

```css
/* app/globals.css */
@import "tailwindcss";
```

```tsx
// app/layout.tsx
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/page.tsx
export default function Home() {
  return <main className="p-8">Publisher Toolkit — Ads Creative</main>
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

- [ ] **Step 6: Create `.gitignore` and `.env.example`**

```
# .gitignore
node_modules
.next
.env*.local
!.env.example
```

```
# .env.example
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
# AI model calls go through the Vercel AI Gateway via OIDC (see Task 7) —
# no direct provider API key is stored here.
```

- [ ] **Step 7: Verify the scaffold builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app for Ads Creative service"
```

---

### Task 2: Database Schema

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`, `lib/db.test.ts`, `.env.test`

**Interfaces:**
- Produces: `prisma: PrismaClient` (from `lib/db.ts`), and models `Book`, `CreativeSet`, `AdCopy`, `CreativeImage` used by every later task.

- [ ] **Step 1: Install Prisma and set up a test database URL**

```bash
npm install prisma@latest @prisma/client@latest
npx prisma init --datasource-provider postgresql
```

Set `DATABASE_URL` in `.env.test` to point at a local Postgres (e.g. `postgresql://postgres:postgres@localhost:5432/ads_creative_test`). Note: the engineer running this task needs a local Postgres reachable at that URL (e.g. `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres`).

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Book {
  id            String        @id @default(cuid())
  publisherId   String
  title         String?
  author        String?
  blurb         String?
  pdfUrl        String
  frontCoverUrl String?
  backCoverUrl  String?
  createdAt     DateTime      @default(now())
  creativeSets  CreativeSet[]

  @@index([publisherId])
}

model CreativeSet {
  id        String          @id @default(cuid())
  bookId    String
  book      Book            @relation(fields: [bookId], references: [id])
  createdAt DateTime        @default(now())
  adCopies  AdCopy[]
  images    CreativeImage[]

  @@index([bookId])
}

model AdCopy {
  id            String      @id @default(cuid())
  creativeSetId String
  creativeSet   CreativeSet @relation(fields: [creativeSetId], references: [id])
  platform      String
  headline      String
  primaryText   String
  description   String

  @@index([creativeSetId])
}

model CreativeImage {
  id            String      @id @default(cuid())
  creativeSetId String
  creativeSet   CreativeSet @relation(fields: [creativeSetId], references: [id])
  platform      String
  sizeKey       String
  width         Int
  height        Int
  imageUrl      String

  @@index([creativeSetId])
}
```

- [ ] **Step 3: Write `lib/db.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 4: Write the failing integration test `lib/db.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from './db'

describe('database schema', () => {
  afterEach(async () => {
    await prisma.creativeImage.deleteMany()
    await prisma.adCopy.deleteMany()
    await prisma.creativeSet.deleteMany()
    await prisma.book.deleteMany()
  })

  it('creates and reads a Book with a nested CreativeSet', async () => {
    const book = await prisma.book.create({
      data: {
        publisherId: 'pub_1',
        title: 'Test Book',
        author: 'Test Author',
        pdfUrl: 'https://blob.example/test.pdf',
        creativeSets: { create: [{}] },
      },
      include: { creativeSets: true },
    })

    expect(book.title).toBe('Test Book')
    expect(book.creativeSets).toHaveLength(1)
  })
})
```

- [ ] **Step 5: Run migration and run the test to verify it fails first (no tables yet)**

Run: `dotenv -e .env.test -- npx prisma migrate dev --name init` (creates tables)
Then temporarily verify the test setup is wired by running: `dotenv -e .env.test -- npx vitest run lib/db.test.ts`
Expected: after `migrate dev`, this PASSES immediately since the schema is already correct — that's fine here since schema and test were authored together; the meaningful gate is Step 6.

- [ ] **Step 6: Run the test to confirm it passes against the real database**

Run: `dotenv -e .env.test -- npx vitest run lib/db.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma lib/db.ts lib/db.test.ts .env.test.example 2>/dev/null; git add -A
git commit -m "feat: add Prisma schema for Book/CreativeSet/AdCopy/CreativeImage"
```

---

### Task 3: Clerk Auth Integration

**Files:**
- Create: `middleware.ts`, `lib/auth.ts`, `lib/auth.test.ts`, `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `app/layout.tsx` (wrap with `<ClerkProvider>`), `.env.example`

**Interfaces:**
- Consumes: none new.
- Produces: `requireCurrentPublisherId(): Promise<string>` — returns the Clerk user id of the signed-in publisher, throws `UnauthenticatedError` if there is none. Every later API route and page uses this to scope data.

- [ ] **Step 1: Provision Clerk and install the SDK**

```bash
vercel integration add clerk   # auto-provisions CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env pull                # brings the provisioned keys into .env.local
npm install @clerk/nextjs@latest
```

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are already in `.env.example` from Task 1 (values come from the Marketplace provisioning above, not hand-typed). Add two more lines to `.env.example`:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

- [ ] **Step 2: Write the failing unit test `lib/auth.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

import { auth } from '@clerk/nextjs/server'
import { requireCurrentPublisherId, UnauthenticatedError } from './auth'

describe('requireCurrentPublisherId', () => {
  it('returns the Clerk userId when signed in', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'pub_123' } as any)
    await expect(requireCurrentPublisherId()).resolves.toBe('pub_123')
  })

  it('throws UnauthenticatedError when signed out', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)
    await expect(requireCurrentPublisherId()).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/auth.test.ts`
Expected: FAIL — `./auth` has no exports yet.

- [ ] **Step 4: Write `lib/auth.ts`**

```ts
import { auth } from '@clerk/nextjs/server'

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthenticatedError'
  }
}

export async function requireCurrentPublisherId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new UnauthenticatedError()
  return userId
}
```

- [ ] **Step 5: Write `middleware.ts` to protect `/dashboard` and `/api/books`**

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/api/books(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

- [ ] **Step 6: Write the sign-in and sign-up pages**

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return <SignIn />
}
```

```tsx
// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return <SignUp />
}
```

- [ ] **Step 7: Wrap the app in `<ClerkProvider>`**

```tsx
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run lib/auth.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Clerk auth, sign-in/sign-up pages, and requireCurrentPublisherId helper"
```

---

### Task 4: PDF Asset Extraction

**Files:**
- Create: `lib/pdf/extract.ts`, `lib/pdf/extract.test.ts`, `lib/pdf/testFixtures.ts`

**Interfaces:**
- Produces:
```ts
export interface ExtractedBookAssets {
  title: string | null
  author: string | null
  blurb: string | null
  frontCoverPng: Buffer | null
  backCoverPng: Buffer | null
}
export async function extractBookAssets(pdfBytes: Buffer): Promise<ExtractedBookAssets>
```
Never throws for a valid-but-uninformative PDF — missing fields come back `null` so the caller can fall back to manual cover upload.

- [ ] **Step 1: Install PDF libraries**

```bash
npm install pdfjs-dist@latest @napi-rs/canvas@latest pdf-lib@latest
```

(`pdf-lib` is a dev/test-only dependency here, used to build fixture PDFs — see Step 2.)

- [ ] **Step 2: Write a fixture builder `lib/pdf/testFixtures.ts`**

```ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function buildFixturePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)

  const page = doc.addPage([400, 600])
  page.drawText('The Lazy Developer', { x: 40, y: 550, size: 24, font })
  page.drawText('by Jane Coder', { x: 40, y: 520, size: 14, font })
  page.drawRectangle({ x: 40, y: 300, width: 320, height: 180, color: rgb(0.2, 0.4, 0.8) })

  const backPage = doc.addPage([400, 600])
  backPage.drawText('A story about shipping less code.', { x: 40, y: 300, size: 12, font })

  return Buffer.from(await doc.save())
}
```

- [ ] **Step 3: Write the failing test `lib/pdf/extract.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { extractBookAssets } from './extract'
import { buildFixturePdf } from './testFixtures'

describe('extractBookAssets', () => {
  it('extracts title/author text and renders front/back cover images', async () => {
    const pdf = await buildFixturePdf()
    const result = await extractBookAssets(pdf)

    expect(result.title).toContain('The Lazy Developer')
    expect(result.frontCoverPng).not.toBeNull()
    expect(result.backCoverPng).not.toBeNull()
    // PNG signature check — first 8 bytes identify a valid PNG.
    expect(result.frontCoverPng!.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  })

  it('returns nulls instead of throwing for an empty/invalid PDF', async () => {
    const result = await extractBookAssets(Buffer.from('not a pdf'))
    expect(result.title).toBeNull()
    expect(result.frontCoverPng).toBeNull()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run lib/pdf/extract.test.ts`
Expected: FAIL — `./extract` has no exports yet.

- [ ] **Step 5: Implement `lib/pdf/extract.ts`**

```ts
import { createCanvas } from '@napi-rs/canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface ExtractedBookAssets {
  title: string | null
  author: string | null
  blurb: string | null
  frontCoverPng: Buffer | null
  backCoverPng: Buffer | null
}

async function renderPageToPng(page: any): Promise<Buffer> {
  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d')
  await page.render({ canvasContext: context as any, viewport }).promise
  return canvas.toBuffer('image/png')
}

async function extractPageText(page: any): Promise<string> {
  const content = await page.getTextContent()
  return content.items.map((item: any) => item.str).join(' ').trim()
}

export async function extractBookAssets(pdfBytes: Buffer): Promise<ExtractedBookAssets> {
  const empty: ExtractedBookAssets = {
    title: null,
    author: null,
    blurb: null,
    frontCoverPng: null,
    backCoverPng: null,
  }

  let doc
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise
  } catch {
    return empty
  }

  if (doc.numPages < 1) return empty

  const firstPage = await doc.getPage(1)
  const firstPageText = await extractPageText(firstPage)
  const lines = firstPageText.split(/\s{2,}|\n/).filter(Boolean)

  const title = lines[0] ?? null
  const authorLine = lines.find((l) => /^by\s+/i.test(l))
  const author = authorLine ? authorLine.replace(/^by\s+/i, '') : null

  let frontCoverPng: Buffer | null = null
  try {
    frontCoverPng = await renderPageToPng(firstPage)
  } catch {
    frontCoverPng = null
  }

  let backCoverPng: Buffer | null = null
  let blurb: string | null = null
  if (doc.numPages > 1) {
    const lastPage = await doc.getPage(doc.numPages)
    try {
      backCoverPng = await renderPageToPng(lastPage)
    } catch {
      backCoverPng = null
    }
    blurb = (await extractPageText(lastPage)) || null
  }

  return { title, author, blurb, frontCoverPng, backCoverPng }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run lib/pdf/extract.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: extract cover images and metadata text from a book PDF"
```

---

### Task 5: Book Upload API + Upload Page

**Files:**
- Create: `lib/blob.ts`, `app/api/books/route.ts`, `app/api/books/route.test.ts`, `app/dashboard/books/new/page.tsx`

**Interfaces:**
- Consumes: `requireCurrentPublisherId()` (Task 3), `extractBookAssets()` (Task 4), `prisma` (Task 2).
- Produces:
```ts
// lib/blob.ts
export async function uploadToBlob(pathname: string, data: Buffer, contentType: string): Promise<{ url: string }>
```
`POST /api/books` accepts `multipart/form-data` with fields `pdf` (required file), `frontCover`/`backCover` (optional files, used when extraction fails or is skipped). Returns `{ id: string, needsManualCover: boolean }`.

- [ ] **Step 1: Install Vercel Blob**

```bash
npm install @vercel/blob@latest
```

- [ ] **Step 2: Write `lib/blob.ts`**

```ts
import { put } from '@vercel/blob'

export async function uploadToBlob(pathname: string, data: Buffer, contentType: string): Promise<{ url: string }> {
  const blob = await put(pathname, data, { access: 'public', contentType })
  return { url: blob.url }
}
```

- [ ] **Step 3: Write the failing test `app/api/books/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/blob', () => ({ uploadToBlob: vi.fn().mockResolvedValue({ url: 'https://blob.example/file' }) }))
vi.mock('@/lib/pdf/extract', () => ({
  extractBookAssets: vi.fn().mockResolvedValue({
    title: 'Test Book',
    author: 'Test Author',
    blurb: 'A blurb',
    frontCoverPng: Buffer.from('png'),
    backCoverPng: Buffer.from('png'),
  }),
}))
vi.mock('@/lib/db', () => ({
  prisma: { book: { create: vi.fn().mockResolvedValue({ id: 'book_1' }) } },
}))

import { POST } from './route'
import { prisma } from '@/lib/db'

function formDataRequest(fields: Record<string, Blob>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new Request('http://localhost/api/books', { method: 'POST', body: form })
}

describe('POST /api/books', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a book from an uploaded PDF with extracted metadata', async () => {
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const res = await POST(formDataRequest({ pdf: pdfBlob }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('book_1')
    expect(json.needsManualCover).toBe(false)
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publisherId: 'pub_1', title: 'Test Book' }),
      })
    )
  })

  it('flags needsManualCover when extraction finds no cover', async () => {
    const { extractBookAssets } = await import('@/lib/pdf/extract')
    vi.mocked(extractBookAssets).mockResolvedValueOnce({
      title: null, author: null, blurb: null, frontCoverPng: null, backCoverPng: null,
    })
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 fake')], { type: 'application/pdf' })
    const res = await POST(formDataRequest({ pdf: pdfBlob }))
    const json = await res.json()

    expect(json.needsManualCover).toBe(true)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run app/api/books/route.test.ts`
Expected: FAIL — `./route` has no exports yet.

- [ ] **Step 5: Implement `app/api/books/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/auth'
import { uploadToBlob } from '@/lib/blob'
import { extractBookAssets } from '@/lib/pdf/extract'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  const publisherId = await requireCurrentPublisherId()
  const form = await request.formData()

  const pdfFile = form.get('pdf') as File | null
  if (!pdfFile) {
    return NextResponse.json({ error: 'pdf is required' }, { status: 400 })
  }
  const pdfBytes = Buffer.from(await pdfFile.arrayBuffer())
  const { url: pdfUrl } = await uploadToBlob(`books/${publisherId}/${Date.now()}.pdf`, pdfBytes, 'application/pdf')

  const extracted = await extractBookAssets(pdfBytes)

  const manualFrontCover = form.get('frontCover') as File | null
  const manualBackCover = form.get('backCover') as File | null

  let frontCoverUrl: string | null = null
  if (manualFrontCover) {
    const bytes = Buffer.from(await manualFrontCover.arrayBuffer())
    frontCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-front.png`, bytes, manualFrontCover.type)).url
  } else if (extracted.frontCoverPng) {
    frontCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-front.png`, extracted.frontCoverPng, 'image/png')).url
  }

  let backCoverUrl: string | null = null
  if (manualBackCover) {
    const bytes = Buffer.from(await manualBackCover.arrayBuffer())
    backCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-back.png`, bytes, manualBackCover.type)).url
  } else if (extracted.backCoverPng) {
    backCoverUrl = (await uploadToBlob(`books/${publisherId}/${Date.now()}-back.png`, extracted.backCoverPng, 'image/png')).url
  }

  const book = await prisma.book.create({
    data: {
      publisherId,
      title: extracted.title,
      author: extracted.author,
      blurb: extracted.blurb,
      pdfUrl,
      frontCoverUrl,
      backCoverUrl,
    },
  })

  return NextResponse.json(
    { id: book.id, needsManualCover: !frontCoverUrl },
    { status: 201 }
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run app/api/books/route.test.ts`
Expected: PASS

- [ ] **Step 7: Write the upload page `app/dashboard/books/new/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewBookPage() {
  const router = useRouter()
  const [needsManualCover, setNeedsManualCover] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    const res = await fetch('/api/books', { method: 'POST', body: formData })
    const json = await res.json()
    setPending(false)
    if (json.needsManualCover) {
      setNeedsManualCover(true)
      return
    }
    router.push(`/dashboard/books/${json.id}`)
  }

  return (
    <form action={handleSubmit} className="p-8 flex flex-col gap-4 max-w-md">
      <h1 className="text-xl font-semibold">Upload a book</h1>
      <input type="file" name="pdf" accept="application/pdf" required />
      {needsManualCover && (
        <>
          <p className="text-sm text-amber-700">
            We couldn&apos;t find a cover in that PDF — please upload one.
          </p>
          <input type="file" name="frontCover" accept="image/*" />
          <input type="file" name="backCover" accept="image/*" />
        </>
      )}
      <button type="submit" disabled={pending} className="bg-black text-white rounded px-4 py-2">
        {pending ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add book upload API and upload page with manual cover fallback"
```

---

### Task 6: Book List + Detail Pages

**Files:**
- Create: `lib/books/queries.ts`, `lib/books/queries.test.ts`, `app/dashboard/page.tsx`, `app/dashboard/books/[id]/page.tsx`

**Interfaces:**
- Produces:
```ts
export function getBooksForPublisher(publisherId: string): Promise<Book[]>
export function getBookForPublisher(publisherId: string, bookId: string): Promise<Book | null>
```
Both scope strictly to `publisherId` — `getBookForPublisher` returns `null` (not another publisher's book) if the book belongs to someone else.

- [ ] **Step 1: Write the failing test `lib/books/queries.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getBooksForPublisher, getBookForPublisher } from './queries'

describe('book queries', () => {
  afterEach(async () => {
    await prisma.book.deleteMany()
  })

  it('only returns books belonging to the given publisher', async () => {
    await prisma.book.create({ data: { publisherId: 'pub_a', pdfUrl: 'x' } })
    const bookB = await prisma.book.create({ data: { publisherId: 'pub_b', pdfUrl: 'y' } })

    const listA = await getBooksForPublisher('pub_a')
    expect(listA).toHaveLength(1)

    const foundAcrossTenant = await getBookForPublisher('pub_a', bookB.id)
    expect(foundAcrossTenant).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/books/queries.test.ts`
Expected: FAIL — `./queries` has no exports yet.

- [ ] **Step 3: Implement `lib/books/queries.ts`**

```ts
import { prisma } from '@/lib/db'
import type { Book } from '@prisma/client'

export function getBooksForPublisher(publisherId: string): Promise<Book[]> {
  return prisma.book.findMany({ where: { publisherId }, orderBy: { createdAt: 'desc' } })
}

export function getBookForPublisher(publisherId: string, bookId: string): Promise<Book | null> {
  return prisma.book.findFirst({ where: { id: bookId, publisherId } })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/books/queries.test.ts`
Expected: PASS

- [ ] **Step 5: Write `app/dashboard/page.tsx`**

```tsx
import Link from 'next/link'
import { requireCurrentPublisherId } from '@/lib/auth'
import { getBooksForPublisher } from '@/lib/books/queries'

export default async function DashboardPage() {
  const publisherId = await requireCurrentPublisherId()
  const books = await getBooksForPublisher(publisherId)

  return (
    <main className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Your books</h1>
        <Link href="/dashboard/books/new" className="bg-black text-white rounded px-4 py-2">
          Upload a book
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {books.map((book) => (
          <li key={book.id}>
            <Link href={`/dashboard/books/${book.id}`}>{book.title ?? 'Untitled book'}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 6: Write `app/dashboard/books/[id]/page.tsx` (metadata display only — generate button comes in Task 9/10)**

```tsx
import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/auth'
import { getBookForPublisher } from '@/lib/books/queries'

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) notFound()

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">{book.title ?? 'Untitled book'}</h1>
      <p className="text-sm text-gray-600">{book.author}</p>
      {book.frontCoverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.frontCoverUrl} alt="Front cover" className="w-48 mt-4" />
      )}
    </main>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add publisher-scoped book list and detail pages"
```

---

### Task 7: Ad Copy Generation

**Files:**
- Create: `lib/ai/generateAdCopy.ts`, `lib/ai/generateAdCopy.test.ts`

**Interfaces:**
- Produces:
```ts
export type AdPlatform = 'META' | 'GOOGLE' | 'AMAZON'
export interface AdCopyResult {
  platform: AdPlatform
  headline: string
  primaryText: string
  description: string
}
export async function generateAdCopy(book: { title: string; author: string; blurb: string }): Promise<AdCopyResult[]>
```
On failure after one retry, returns `[]` — callers must treat an empty array as "no copy generated, leave blank."

- [ ] **Step 1: Install the AI SDK and zod (model calls route through the Vercel AI Gateway — no provider package or API key needed)**

```bash
npm install ai@latest zod@latest
```

Local dev authenticates to the Gateway via Vercel OIDC: run `vercel link` once, then `vercel env pull` to get an OIDC token in `.env.local`. No direct provider credential is stored or read.

- [ ] **Step 2: Write the failing test `lib/ai/generateAdCopy.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

import { generateText } from 'ai'
import { generateAdCopy } from './generateAdCopy'

const book = { title: 'The Lazy Developer', author: 'Jane Coder', blurb: 'A story about shipping less code.' }

describe('generateAdCopy', () => {
  it('returns copy for each platform on success', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        variants: [
          { platform: 'META', headline: 'H', primaryText: 'P', description: 'D' },
          { platform: 'GOOGLE', headline: 'H2', primaryText: 'P2', description: 'D2' },
          { platform: 'AMAZON', headline: 'H3', primaryText: 'P3', description: 'D3' },
        ],
      },
    } as any)

    const result = await generateAdCopy(book)
    expect(result).toHaveLength(3)
    expect(result[0].platform).toBe('META')
  })

  it('retries once and returns [] if generation keeps failing', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('rate limited'))

    const result = await generateAdCopy(book)
    expect(result).toEqual([])
    expect(generateText).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/ai/generateAdCopy.test.ts`
Expected: FAIL — `./generateAdCopy` has no exports yet.

- [ ] **Step 4: Implement `lib/ai/generateAdCopy.ts`**

Model id `anthropic/claude-sonnet-5` was confirmed live against `https://ai-gateway.vercel.sh/v1/models` while writing this plan — re-check that endpoint if it's been a while before assuming it's still current.

```ts
import { generateText, Output } from 'ai'
import { z } from 'zod'

export type AdPlatform = 'META' | 'GOOGLE' | 'AMAZON'

export interface AdCopyResult {
  platform: AdPlatform
  headline: string
  primaryText: string
  description: string
}

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

async function attemptGeneration(book: { title: string; author: string; blurb: string }) {
  const { output } = await generateText({
    model: 'anthropic/claude-sonnet-5',
    output: Output.object({ schema: adCopySchema }),
    prompt: `Write ad copy for a book, one variant each for Meta, Google, and Amazon ads.
Book title: ${book.title}
Author: ${book.author}
Blurb: ${book.blurb}
Meta: casual, hook-driven headline (<=40 chars), primary text (<=125 chars).
Google: benefit-driven headline (<=30 chars), description (<=90 chars).
Amazon: straightforward, title/author forward.`,
  })
  return output.variants
}

export async function generateAdCopy(book: { title: string; author: string; blurb: string }): Promise<AdCopyResult[]> {
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

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/ai/generateAdCopy.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: generate per-platform ad copy with Claude, retry-once-then-blank on failure"
```

---

### Task 8: Creative Templates + Image Rendering

**Files:**
- Create: `lib/templates/specs.ts`, `lib/templates/CreativeTemplate.tsx`, `lib/compositing/renderCreativeImages.tsx`, `lib/compositing/renderCreativeImages.test.ts`, `lib/compositing/pngSize.ts`

**Interfaces:**
- Consumes: `AdPlatform` (Task 7).
- Produces:
```ts
// lib/templates/specs.ts
export interface CreativeSizeSpec { key: string; platform: AdPlatform; width: number; height: number }
export const CREATIVE_SIZES: CreativeSizeSpec[]

// lib/compositing/renderCreativeImages.tsx
export interface RenderedCreativeImage { sizeKey: string; platform: AdPlatform; width: number; height: number; pngBuffer: Buffer }
export async function renderCreativeImages(input: { coverImageUrl: string; title: string; author: string }): Promise<RenderedCreativeImage[]>
```

- [ ] **Step 1: Write `lib/templates/specs.ts`** (exact sizes from the spec)

```ts
import type { AdPlatform } from '@/lib/ai/generateAdCopy'

export interface CreativeSizeSpec {
  key: string
  platform: AdPlatform
  width: number
  height: number
}

export const CREATIVE_SIZES: CreativeSizeSpec[] = [
  { key: 'meta_feed_1080x1080', platform: 'META', width: 1080, height: 1080 },
  { key: 'meta_story_1080x1920', platform: 'META', width: 1080, height: 1920 },
  { key: 'google_display_300x250', platform: 'GOOGLE', width: 300, height: 250 },
  { key: 'google_display_728x90', platform: 'GOOGLE', width: 728, height: 90 },
  { key: 'amazon_300x250', platform: 'AMAZON', width: 300, height: 250 },
]
```

- [ ] **Step 2: Write a small PNG dimension reader for tests, `lib/compositing/pngSize.ts`**

```ts
export function readPngSize(buf: Buffer): { width: number; height: number } {
  // PNG IHDR chunk: width/height are 4-byte big-endian ints starting at byte 16.
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}
```

- [ ] **Step 3: Write the shared template `lib/templates/CreativeTemplate.tsx`**

```tsx
export function CreativeTemplate({
  coverImageUrl,
  title,
  author,
  width,
  height,
}: {
  coverImageUrl: string
  title: string
  author: string
  width: number
  height: number
}) {
  const isBanner = height <= 250 && width > height
  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: isBanner ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111827',
        color: 'white',
        fontFamily: 'sans-serif',
        padding: 16,
        gap: 12,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverImageUrl}
        width={isBanner ? height - 32 : Math.min(width, height) * 0.6}
        height={isBanner ? height - 32 : Math.min(width, height) * 0.6}
        style={{ objectFit: 'cover', borderRadius: 8 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: isBanner ? 16 : 28, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: isBanner ? 12 : 18, opacity: 0.8 }}>{author}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write the failing test `lib/compositing/renderCreativeImages.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { renderCreativeImages } from './renderCreativeImages'
import { CREATIVE_SIZES } from '@/lib/templates/specs'
import { readPngSize } from './pngSize'

describe('renderCreativeImages', () => {
  it('renders one PNG per creative size at the correct dimensions', async () => {
    const images = await renderCreativeImages({
      coverImageUrl: 'https://example.com/cover.png',
      title: 'The Lazy Developer',
      author: 'Jane Coder',
    })

    expect(images).toHaveLength(CREATIVE_SIZES.length)
    for (const spec of CREATIVE_SIZES) {
      const image = images.find((i) => i.sizeKey === spec.key)
      expect(image).toBeDefined()
      const { width, height } = readPngSize(image!.pngBuffer)
      expect(width).toBe(spec.width)
      expect(height).toBe(spec.height)
    }
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run lib/compositing/renderCreativeImages.test.ts`
Expected: FAIL — `./renderCreativeImages` has no exports yet.

- [ ] **Step 6: Implement `lib/compositing/renderCreativeImages.tsx`** (must be `.tsx`, not `.ts` — it contains JSX)

```ts
import { ImageResponse } from 'next/og'
import { CREATIVE_SIZES } from '@/lib/templates/specs'
import { CreativeTemplate } from '@/lib/templates/CreativeTemplate'
import type { AdPlatform } from '@/lib/ai/generateAdCopy'

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
}): Promise<RenderedCreativeImage[]> {
  const results: RenderedCreativeImage[] = []

  for (const spec of CREATIVE_SIZES) {
    const response = new ImageResponse(
      (
        <CreativeTemplate
          coverImageUrl={input.coverImageUrl}
          title={input.title}
          author={input.author}
          width={spec.width}
          height={spec.height}
        />
      ),
      { width: spec.width, height: spec.height }
    )
    const arrayBuffer = await response.arrayBuffer()
    results.push({
      sizeKey: spec.key,
      platform: spec.platform,
      width: spec.width,
      height: spec.height,
      pngBuffer: Buffer.from(arrayBuffer),
    })
  }

  return results
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run lib/compositing/renderCreativeImages.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: render platform-sized ad creative images from a shared template"
```

---

### Task 9: Generate-Creatives Endpoint

**Files:**
- Create: `app/api/books/[id]/generate/route.ts`, `app/api/books/[id]/generate/route.test.ts`

**Interfaces:**
- Consumes: `getBookForPublisher` (Task 6), `generateAdCopy` (Task 7), `renderCreativeImages` (Task 8), `uploadToBlob` (Task 5), `prisma` (Task 2).
- Produces: `POST /api/books/:id/generate` → `{ creativeSetId: string }` (201), or 404 if the book doesn't belong to the caller, or 400 if the book has no cover image at all.

- [ ] **Step 1: Write the failing test `app/api/books/[id]/generate/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireCurrentPublisherId: vi.fn().mockResolvedValue('pub_1') }))
vi.mock('@/lib/books/queries', () => ({
  getBookForPublisher: vi.fn().mockResolvedValue({
    id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: 'https://x/cover.png',
  }),
}))
vi.mock('@/lib/ai/generateAdCopy', () => ({ generateAdCopy: vi.fn() }))
vi.mock('@/lib/compositing/renderCreativeImages', () => ({ renderCreativeImages: vi.fn() }))
vi.mock('@/lib/blob', () => ({ uploadToBlob: vi.fn().mockResolvedValue({ url: 'https://blob.example/img.png' }) }))
vi.mock('@/lib/db', () => ({
  prisma: {
    creativeSet: {
      create: vi.fn().mockResolvedValue({ id: 'set_1' }),
    },
    adCopy: { createMany: vi.fn() },
    creativeImage: { createMany: vi.fn() },
  },
}))

import { POST } from './route'
import { generateAdCopy } from '@/lib/ai/generateAdCopy'
import { renderCreativeImages } from '@/lib/compositing/renderCreativeImages'
import { prisma } from '@/lib/db'
import { getBookForPublisher } from '@/lib/books/queries'

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/books/:id/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a creative set with copy and images on success', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue([
      { platform: 'META', headline: 'H', primaryText: 'P', description: 'D' },
    ])
    vi.mocked(renderCreativeImages).mockResolvedValue([
      { sizeKey: 'meta_feed_1080x1080', platform: 'META', width: 1080, height: 1080, pngBuffer: Buffer.from('png') },
    ])

    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.creativeSetId).toBe('set_1')
    expect(prisma.adCopy.createMany).toHaveBeenCalled()
    expect(prisma.creativeImage.createMany).toHaveBeenCalled()
  })

  it('still creates the creative set with no copy rows if copy generation fails', async () => {
    vi.mocked(generateAdCopy).mockResolvedValue([])
    vi.mocked(renderCreativeImages).mockResolvedValue([
      { sizeKey: 'meta_feed_1080x1080', platform: 'META', width: 1080, height: 1080, pngBuffer: Buffer.from('png') },
    ])

    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(201)
    expect(prisma.adCopy.createMany).toHaveBeenCalledWith({ data: [] })
  })

  it('returns 404 when the book does not belong to the caller', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when the book has no cover image', async () => {
    vi.mocked(getBookForPublisher).mockResolvedValueOnce({
      id: 'book_1', title: 'T', author: 'A', blurb: 'B', frontCoverUrl: null,
    } as any)
    const res = await POST(new Request('http://localhost'), ctx('book_1'))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/books/[id]/generate/route.test.ts`
Expected: FAIL — `./route` has no exports yet.

- [ ] **Step 3: Implement `app/api/books/[id]/generate/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { requireCurrentPublisherId } from '@/lib/auth'
import { getBookForPublisher } from '@/lib/books/queries'
import { generateAdCopy } from '@/lib/ai/generateAdCopy'
import { renderCreativeImages } from '@/lib/compositing/renderCreativeImages'
import { uploadToBlob } from '@/lib/blob'
import { prisma } from '@/lib/db'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!book.frontCoverUrl) {
    return NextResponse.json({ error: 'book has no cover image' }, { status: 400 })
  }

  const [adCopyVariants, renderedImages] = await Promise.all([
    generateAdCopy({ title: book.title ?? '', author: book.author ?? '', blurb: book.blurb ?? '' }),
    renderCreativeImages({ coverImageUrl: book.frontCoverUrl, title: book.title ?? '', author: book.author ?? '' }),
  ])

  const creativeSet = await prisma.creativeSet.create({ data: { bookId: book.id } })

  await prisma.adCopy.createMany({
    data: adCopyVariants.map((v) => ({
      creativeSetId: creativeSet.id,
      platform: v.platform,
      headline: v.headline,
      primaryText: v.primaryText,
      description: v.description,
    })),
  })

  const uploadedImages = await Promise.all(
    renderedImages.map(async (img) => {
      const { url } = await uploadToBlob(
        `creatives/${creativeSet.id}/${img.sizeKey}.png`,
        img.pngBuffer,
        'image/png'
      )
      return { creativeSetId: creativeSet.id, platform: img.platform, sizeKey: img.sizeKey, width: img.width, height: img.height, imageUrl: url }
    })
  )
  await prisma.creativeImage.createMany({ data: uploadedImages })

  return NextResponse.json({ creativeSetId: creativeSet.id }, { status: 201 })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/books/[id]/generate/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add generate-creatives endpoint tying together copy and image generation"
```

---

### Task 10: Creative Set Display + Download

**Files:**
- Create: `lib/creativeSets/queries.ts`, `lib/creativeSets/queries.test.ts`, `app/dashboard/books/[id]/GenerateButton.tsx`
- Modify: `app/dashboard/books/[id]/page.tsx`

**Interfaces:**
- Produces: `getLatestCreativeSetForBook(bookId: string): Promise<CreativeSetWithChildren | null>` where `CreativeSetWithChildren` includes `adCopies` and `images`.

- [ ] **Step 1: Write the failing test `lib/creativeSets/queries.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { getLatestCreativeSetForBook } from './queries'

describe('getLatestCreativeSetForBook', () => {
  afterEach(async () => {
    await prisma.creativeImage.deleteMany()
    await prisma.adCopy.deleteMany()
    await prisma.creativeSet.deleteMany()
    await prisma.book.deleteMany()
  })

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

    const result = await getLatestCreativeSetForBook(book.id)
    expect(result?.id).toBe(latest.id)
    expect(result?.adCopies).toHaveLength(1)
    expect(result?.images).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/creativeSets/queries.test.ts`
Expected: FAIL — `./queries` has no exports yet.

- [ ] **Step 3: Implement `lib/creativeSets/queries.ts`**

```ts
import { prisma } from '@/lib/db'

export function getLatestCreativeSetForBook(bookId: string) {
  return prisma.creativeSet.findFirst({
    where: { bookId },
    orderBy: { createdAt: 'desc' },
    include: { adCopies: true, images: true },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/creativeSets/queries.test.ts`
Expected: PASS

- [ ] **Step 5: Update `app/dashboard/books/[id]/page.tsx`** to add a "Generate creatives" button and display the latest set

```tsx
import { notFound } from 'next/navigation'
import { requireCurrentPublisherId } from '@/lib/auth'
import { getBookForPublisher } from '@/lib/books/queries'
import { getLatestCreativeSetForBook } from '@/lib/creativeSets/queries'
import { GenerateButton } from './GenerateButton'

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const publisherId = await requireCurrentPublisherId()
  const book = await getBookForPublisher(publisherId, id)
  if (!book) notFound()

  const creativeSet = await getLatestCreativeSetForBook(book.id)

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">{book.title ?? 'Untitled book'}</h1>
      <p className="text-sm text-gray-600">{book.author}</p>
      {book.frontCoverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.frontCoverUrl} alt="Front cover" className="w-48 mt-4" />
      )}

      <div className="mt-6">
        <GenerateButton bookId={book.id} />
      </div>

      {creativeSet && (
        <section className="mt-8 grid grid-cols-2 gap-6">
          {creativeSet.images.map((image) => (
            <div key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.imageUrl} alt={image.sizeKey} className="border rounded" />
              <a href={image.imageUrl} download className="text-sm underline">
                Download {image.sizeKey}
              </a>
            </div>
          ))}
          {creativeSet.adCopies.map((copy) => (
            <div key={copy.id} className="text-sm">
              <strong>{copy.platform}</strong>: {copy.headline} — {copy.primaryText}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Write the client component `app/dashboard/books/[id]/GenerateButton.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function GenerateButton({ bookId }: { bookId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    await fetch(`/api/books/${bookId}/generate`, { method: 'POST' })
    setPending(false)
    router.refresh()
  }

  return (
    <button onClick={handleClick} disabled={pending} className="bg-black text-white rounded px-4 py-2">
      {pending ? 'Generating…' : 'Generate creatives'}
    </button>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: display and download generated creative sets on the book detail page"
```

---

### Task 11: End-to-End Test

**Files:**
- Create: `e2e/generate-creatives.spec.ts`, `playwright.config.ts`
- Modify: `package.json` (add `test:e2e` script)

**Interfaces:**
- Consumes: the full app (Tasks 1–10) running via `next dev`.

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test@latest
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:3000' },
})
```

- [ ] **Step 3: Add `test:e2e` script to `package.json`**

```json
{ "scripts": { "test:e2e": "playwright test" } }
```

- [ ] **Step 4: Write the failing e2e test `e2e/generate-creatives.spec.ts`**

Uses Clerk's testing token support to bypass real sign-in (`@clerk/testing`), and a small fixture PDF checked in at `e2e/fixtures/sample-book.pdf` (generate it once with the `buildFixturePdf()` helper from Task 4 and save the output, or any real short PDF).

```bash
npm install -D @clerk/testing@latest
```

```ts
import { test, expect } from '@playwright/test'
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright'
import path from 'node:path'

test.beforeAll(async () => {
  await clerkSetup()
})

test('publisher uploads a book and generates creatives', async ({ page }) => {
  await setupClerkTestingToken({ page })

  await page.goto('/dashboard/books/new')
  await page.setInputFiles('input[name="pdf"]', path.join(__dirname, 'fixtures/sample-book.pdf'))
  await page.click('button[type="submit"]')

  await page.waitForURL(/\/dashboard\/books\/.+/)
  await page.click('text=Generate creatives')

  await expect(page.locator('img[alt="meta_feed_1080x1080"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('text=Download meta_feed_1080x1080')).toBeVisible()
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test:e2e`
Expected: FAIL initially if the fixture PDF is missing or Clerk test env vars (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` with a test instance) aren't set — resolve those, then it should exercise the full flow.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:e2e`
Expected: PASS against the real Next.js dev server, real (test) Clerk instance, and a real (or sandboxed) database/Blob/Anthropic key.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: add e2e coverage for the upload-to-generate-creatives flow"
```

---

## Self-Review Notes

- **Spec coverage:** publisher auth/tenancy (Task 3, 6), book upload with cover extraction + manual fallback (Task 4, 5), ad copy generation with retry-once-then-blank (Task 7), template compositing at the spec's exact sizes (Task 8), tying it together with the same error-handling rules (Task 9), viewing/downloading (Task 10), e2e flow (Task 11). Ads connectors (Meta/Google OAuth + push) are explicitly deferred to a follow-up plan, per the scope split agreed with the user.
- **Type consistency checked:** `AdPlatform` defined once in `lib/ai/generateAdCopy.ts` and imported everywhere else (`lib/templates/specs.ts`, `lib/compositing/renderCreativeImages.tsx`) rather than redefined. `ExtractedBookAssets`, `AdCopyResult`, `RenderedCreativeImage`, `CreativeSizeSpec` are each defined once and reused by name across tasks.
- **No placeholders:** every step has runnable code; no "add error handling" left unspecified — the specific retry/fallback rules from the spec are implemented directly in Tasks 4, 5, 7, and 9.
