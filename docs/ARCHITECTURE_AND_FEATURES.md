# Publisher Toolkit — Architecture & Feature Engineering Guide

This document provides a comprehensive technical overview of the **Publisher Toolkit** architecture, data flow, feature implementations, and developer extension guides.

---

## 1. High-Level System Architecture

The Publisher Toolkit is built as a high-performance Next.js 15 (App Router) platform combining React 19, Prisma ORM, Satori Canvas rendering, Remotion video generation, and AI-powered copy engineering.

```mermaid
flowchart TD
    subgraph ClientLayer["Frontend & Client Layer (React 19 / Next.js 15)"]
        UI_Nav["Studio Navigation & Shell"]
        UI_Ads["Amazon Ads & A+ Studio (/ads)"]
        UI_Trailer["Video Trailer Studio (/trailer)"]
        UI_Audio["Audiobook Studio (/audiobook)"]
        UI_Landing["Landing Page Studio (/landing)"]
        UI_Remotion["Remotion Live Player (Browser WebGL/Canvas)"]
    end

    subgraph APILayer["API & Route Handlers (Next.js Server Runtime)"]
        API_Ads["/api/ads/projects (CRUD, Extract, Generate, Download)"]
        API_Trailer["/api/trailer/projects (Render, Presets, Export)"]
        API_Audio["/api/audiobook/projects (TTS, Chapters, Audio Stream)"]
        API_Landing["/api/landing/projects (Agent Generation, Zip)"]
        API_Files["/api/files/[...path] (Secure File Serving)"]
    end

    subgraph EngineLayer["Core Processing & Generation Engines"]
        ENG_AI["LLM Copywriting Engine (Vercel AI SDK / OpenRouter)"]
        ENG_PDF["PDF Parsing Engine (unpdf / pdfjs-dist)"]
        ENG_Satori["Satori Image Renderer (SVG/PNG Layouts)"]
        ENG_Remotion["Remotion / Canvas Engine (@napi-rs/canvas + FFmpeg)"]
        ENG_TTS["TTS Synthesis Engine (Fish Audio / Kokoro Models)"]
        ENG_Zip["JSZip Packaging Service (Multi-Asset ZIP Bundler)"]
    end

    subgraph DataLayer["Persistence & Storage Layer"]
        DB[(PostgreSQL Database via Prisma ORM)]
        STORAGE["Storage Abstraction (Local Filesystem / @vercel/blob)"]
    end

    ClientLayer --> APILayer
    APILayer --> EngineLayer
    APILayer --> DataLayer
    EngineLayer --> STORAGE
    EngineLayer --> DB
```

---

## 2. End-to-End Data Flow

The following sequence illustrates how a publisher uploads a manuscript/cover and generates a complete Amazon campaign kit with A+ Content and an HD video trailer:

```mermaid
sequenceDiagram
    autonumber
    actor Publisher as Publisher / Author
    participant Web as Next.js Web App
    participant API as Route Handlers
    participant PDF as PDF Extraction Engine
    participant LLM as Vercel AI / OpenRouter
    participant Satori as Satori / Canvas Image Engine
    participant Video as Remotion / FFmpeg Video Engine
    participant Storage as File Storage Provider
    participant DB as PostgreSQL (Prisma)

    Publisher->>Web: Uploads PDF / Book Cover
    Web->>API: POST /api/ads/projects (Multipart Form)
    API->>Storage: Store PDF & Cover Image
    API->>PDF: Extract Title, Author, Blurb, Front/Back Covers
    PDF-->>API: Extracted Book Metadata
    API->>DB: Create Book record (status: 'uploaded')
    API-->>Web: Redirect to /ads/[id]/configure

    Publisher->>Web: Configures Tone, Objective, Style, & Video Parameters
    Web->>API: PATCH /api/ads/projects/[id]
    API->>DB: Update Book record (status: 'configured')
    Web-->>Publisher: Displays Real-Time Remotion Live Preview

    Publisher->>Web: Clicks "Generate Amazon Creatives & Video"
    Web->>API: POST /api/ads/projects/[id]/generate
    
    par Parallel Generation
        API->>LLM: Generate Amazon Ad Copy & Targeting Hooks
        LLM-->>API: Headlines, Primary Text, Descriptions
    and
        API->>Satori: Render Amazon A+ Modules (970x600, 970x300, 300x300) & Banners
        Satori-->>API: PNG Buffers
    and
        API->>Video: Render Remotion Video Trailer (4 Scenes + Specular Sheen + Audio)
        Video-->>API: MP4 Buffer & High-Res Poster Frame
    end

    API->>Storage: Store PNGs, MP4, and Poster
    API->>DB: Create CreativeSet, AdCopies, CreativeImages
    API->>DB: Update Book status to 'generated'
    API-->>Web: HTTP 201 { creativeSetId }
    Web-->>Publisher: Display Creative Gallery & Amazon Launch Hub

    Publisher->>Web: Clicks "Download Complete Kit (.zip)"
    Web->>API: GET /api/ads/projects/[id]/download
    API->>Storage: Fetch all PNGs, MP4, Poster
    API-->>Publisher: Streamed ZIP archive (A+ banners, MP4, copy.txt)
```

---

## 3. Detailed Feature Breakdown

### Feature 1: Amazon Ads & KDP A+ Content Suite
* **Primary Route**: `/ads`
* **Entry Point**: [`app/(platform)/ads/page.tsx`](file:///home/pratap/work/Publisher_toolkit/app/(platform)/ads/page.tsx)
* **Configuration Form**: [`components/ads/ConfigureForm.tsx`](file:///home/pratap/work/Publisher_toolkit/components/ads/ConfigureForm.tsx)
* **Image Template**: [`lib/services/ads/CreativeTemplate.tsx`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/CreativeTemplate.tsx)
* **Results Gallery**: [`components/ads/CreativeGallery.tsx`](file:///home/pratap/work/Publisher_toolkit/components/ads/CreativeGallery.tsx)
* **Launch Hub**: [`components/ads/AmazonPackagePanel.tsx`](file:///home/pratap/work/Publisher_toolkit/components/ads/AmazonPackagePanel.tsx)

#### Supported Amazon Specifications
| Format Key | Dimensions | Aspect Ratio | Target Placement |
| :--- | :--- | :--- | :--- |
| `amazon_aplus_banner_970x600` | 970 × 600 px | ~1.62:1 | Amazon KDP Standard Image Header / Hero Module |
| `amazon_aplus_feature_970x300` | 970 × 300 px | 3.23:1 | Amazon KDP Standard Technical Specifications / Feature Banner |
| `amazon_aplus_square_300x300` | 300 × 300 px | 1:1 | Amazon KDP Standard Four Image / Highlight Quad Module |
| `amazon_300x250` | 300 × 250 px | 1.2:1 | Amazon Sponsored Display & Kindle Lockscreen Ads |
| `amazon_1200x628` | 1200 × 628 px | 1.91:1 | Amazon Sponsored Brands Top-of-Search Headline Banner |
| `video-trailer.mp4` | 1920 × 1080 px | 16:9 | Amazon Sponsored Brands Video & Product Detail Video |

#### Key Logic & Implementation Details
1. **Intelligent Ratio Adaptation**: `CreativeTemplate.tsx` checks if the image aspect ratio `width / height >= 1.5` (such as the 970×300 and 970×600 A+ banners) and automatically switches to a horizontal layout with cover on the left/right, title/author typography with Fraunces serif, and KDP badge tokens.
2. **AI Copywriting**: `generateAdCopy` in [`lib/services/ads/copy.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/copy.ts) crafts concise headlines (max 80 chars) and primary text (max 150 chars) adhering to Amazon Advertising guidelines.
3. **Unified ZIP Packaging**: In [`lib/services/ads/zip.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/zip.ts), the archive bundles `amazon/` image assets, `amazon/video-trailer.mp4`, `amazon/video-poster.png`, and a formatted `copy.txt` for immediate deployment.

---

### Feature 2: Cinematic Video Trailer Studio & Hyperframes Motion
* **Primary Route**: `/trailer` and integrated into `/ads/[projectId]/configure`
* **Live Remotion Player**: [`components/trailer/TrailerLivePreviewPlayer.tsx`](file:///home/pratap/work/Publisher_toolkit/components/trailer/TrailerLivePreviewPlayer.tsx)
* **Remotion Composition**: [`components/trailer/remotion/BookTrailerComposition.tsx`](file:///home/pratap/work/Publisher_toolkit/components/trailer/remotion/BookTrailerComposition.tsx)
* **Headless Server Video Engine**: [`lib/services/trailer/video.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/trailer/video.ts)

#### Visual Hierarchy & Scene Progression
The trailer engine generates a structured 4-scene cinematic teaser:
1. **Scene 1 — Hook & Genre Atmosphere** (Frames 0–75 / 0–2.5s):
   - Hook headline with kinetic spring typography.
   - Dynamic atmospheric particle system (embers, dust motes, neon scanlines).
2. **Scene 2 — The Story Excerpt** (Frames 75–150 / 2.5–5.0s):
   - Blurb synopsis teaser text with smooth opacity fade and author attribution.
3. **Scene 3 — 3D Book Cover Reveal** (Frames 150–225 / 5.0–7.5s):
   - 3D physical book presentation with book thickness, page block texture, and drop shadow.
   - **Hyperframe Specular Sheen**: Dynamic light gradient sweeping across the cover gloss.
   - Volumetric spine depth shadow.
4. **Scene 4 — Outro & Call to Action** (Frames 225–300 / 7.5–10.0s):
   - Primary Call to Action ("Available on Kindle & Paperback").
   - Publisher imprint mark and buy badges.

#### Audio & Style Presets
* **Styles**: `fantasy`, `thriller`, `scifi`, `romance`, `cinematic`, `minimal`, `dramatic`, `energetic`.
* **Audio Moods**: `epic` (orchestral brass & drums), `suspenseful` (noir bass & clock ticks), `ambient` (warm acoustic pads), `upbeat` (modern synth pulses), `emotional` (cinematic piano).

---

### Feature 3: AI Audiobook Studio
* **Primary Route**: `/audiobook`
* **Entry Point**: [`app/(platform)/audiobook/page.tsx`](file:///home/pratap/work/Publisher_toolkit/app/(platform)/audiobook/page.tsx)
* **Chapter Parsing**: [`lib/services/audiobook/chapterParser.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/audiobook/chapterParser.ts)
* **TTS Synthesis**: [`lib/services/audiobook/tts.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/audiobook/tts.ts)
* **Audio Player Gallery**: [`components/audiobook/AudiobookPlayerGallery.tsx`](file:///home/pratap/work/Publisher_toolkit/components/audiobook/AudiobookPlayerGallery.tsx)

#### Architecture
* **Chapter Extraction**: Inspects uploaded PDF text stream, identifying chapter markers (`Chapter 1`, `Prologue`, roman numerals, or numbered titles) and parses them into individual `AudiobookChapter` entities.
* **TTS Pipeline**: Supports pluggable TTS synthesis providers:
  - **Fish Audio** (`fishaudio`)
  - **Kokoro** (`kokoro`)
  - **Local Simulated Audio** (for offline dev/test environments).
* **Voice Profiles**: Warm Literary (`warm-literary`), Dramatic Narrator (`dramatic-deep`), Expressive Character (`expressive-story`), Crisp Non-Fiction (`clear-authoritative`).
* **Pacing & Audio Format**: Configurable speed multiplier (`0.8x` to `1.3x`) and export formats (`mp3` / `wav`).

---

### Feature 4: Book Landing Page Generator
* **Primary Route**: `/landing`
* **Entry Point**: [`app/(platform)/landing/page.tsx`](file:///home/pratap/work/Publisher_toolkit/app/(platform)/landing/page.tsx)
* **Renderer**: [`lib/services/landing/renderer.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/landing/renderer.ts)
* **Agent Logic**: [`lib/services/landing/agent.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/landing/agent.ts)

#### Capabilities
* Generates a fully self-contained, responsive promotional landing page for the book.
* Injects extracted synopsis, buy buttons (Amazon, Barnes & Noble, Apple Books, Kobo), author bio, chapter excerpts, and praise quotes.
* Provides a 1-click downloadable ZIP archive containing standard HTML5, clean modern CSS, and bundled cover image assets ready to host on Vercel, Netlify, or GitHub Pages.

---

### Feature 5: Publisher Imprint & Brand Settings
* **Primary Route**: `/settings`
* **Entry Point**: [`app/(platform)/settings/page.tsx`](file:///home/pratap/work/Publisher_toolkit/app/(platform)/settings/page.tsx)
* **Form Component**: [`components/platform/SettingsForm.tsx`](file:///home/pratap/work/Publisher_toolkit/components/platform/SettingsForm.tsx)
* **Data Layer**: [`lib/publisher/settings.ts`](file:///home/pratap/work/Publisher_toolkit/lib/publisher/settings.ts)

#### Settings Parameters
* Imprint Name, Website, Default Accent Color, and Typography preference.
* Default Book Retailer Links (Amazon Storefront URL, Kindle Direct Publishing tag, Author website).
* Default copy tone and campaign objectives applied automatically to newly uploaded books.

---

## 4. Prisma Database Schema & Entity Relationships

The data layer is managed with Prisma ORM targeting PostgreSQL.

```mermaid
erDiagram
    Publisher ||--o{ Book : "owns"
    Publisher ||--o{ TrailerProject : "owns"
    Publisher ||--o{ AudiobookProject : "owns"
    Publisher ||--o{ LandingProject : "owns"

    Book ||--o{ CreativeSet : "has many"
    Book ||--o{ Book : "parent/child library variants"

    CreativeSet ||--o{ AdCopy : "contains"
    CreativeSet ||--o{ CreativeImage : "contains"

    TrailerProject ||--o{ GeneratedTrailer : "renders"
    AudiobookProject ||--o{ AudiobookChapter : "contains"

    Publisher {
        string id PK
        string name
        string email
        json settings
        datetime createdAt
    }

    Book {
        string id PK
        string publisherId FK
        string title
        string author
        string blurb
        string pdfUrl
        string frontCoverUrl
        string backCoverUrl
        string status
        string[] platforms
        string copyTone
        string templateKey
        string campaignName
        string campaignObjective
        string targetAudience
        string customHook
        string ctaText
        boolean includeVideo
        string videoFormat
        string videoStyle
        string videoMood
        string videoLength
        string parentBookId FK
    }

    CreativeSet {
        string id PK
        string bookId FK
        string campaignName
        string campaignObjective
        string templateKey
        string videoUrl
        string videoPosterUrl
        int videoDuration
        datetime createdAt
    }

    AdCopy {
        string id PK
        string creativeSetId FK
        string platform
        string headline
        string primaryText
        string description
    }

    CreativeImage {
        string id PK
        string creativeSetId FK
        string platform
        string sizeKey
        int width
        int height
        string imageUrl
    }

    TrailerProject {
        string id PK
        string publisherId FK
        string title
        string author
        string blurb
        string status
        string style
        string length
        string musicMood
        string aspectRatio
    }

    GeneratedTrailer {
        string id PK
        string projectId FK
        string aspectRatio
        string videoUrl
        string posterUrl
        int duration
        int width
        int height
    }

    AudiobookProject {
        string id PK
        string publisherId FK
        string title
        string author
        string ttsProvider
        string voiceModel
        float voicePacing
        string fullAudioUrl
    }

    AudiobookChapter {
        string id PK
        string projectId FK
        int chapterNumber
        string title
        string audioUrl
        int duration
    }
```

---

## 5. Storage & File Serving Architecture

All binary assets (PDFs, book covers, Satori PNG images, MP4 video trailers, poster frames, and audio MP3s) flow through the uniform storage abstraction defined in [`lib/providers/storage.ts`](file:///home/pratap/work/Publisher_toolkit/lib/providers/storage.ts).

```mermaid
flowchart LR
    UploadClient["Client / Generation Pipeline"] -->|storeFile(path, buffer, mime)| StorageRouter{"Storage Provider"}
    StorageRouter -->|BLOB_READ_WRITE_TOKEN exists| VercelBlob["Vercel Blob Storage"]
    StorageRouter -->|No token (Local Dev)| LocalDisk["Local Disk (/public/uploads or tmp)"]

    LocalDisk -->|Stored at /api/files/...| FileServer["Secure Route: /api/files/[...path]"]
    VercelBlob -->|Public CDN URL| DirectCDN["Vercel Blob CDN"]

    FileServer -->|Auth & Publisher Scope Check| BrowserClient["Client Browser"]
    DirectCDN --> BrowserClient
```

### Key Rules
* Never expose raw database file paths. Always use storage URLs generated by `storeFile`.
* For authenticated image downloads, [`app/api/creatives/[id]/image/route.ts`](file:///home/pratap/work/Publisher_toolkit/app/api/creatives/[id]/image/route.ts) validates that the requesting session owns the book before serving bytes.

---

## 6. Developer Playbook: How to Make Changes

### A. Adding a New Amazon A+ Content Size or Banner Spec
1. Open [`lib/services/ads/sizes.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/sizes.ts).
2. Add your new specification to `CREATIVE_SIZES`:
   ```ts
   {
     key: 'amazon_aplus_comparison_970x150',
     platform: 'AMAZON',
     width: 970,
     height: 150,
     label: 'Amazon A+ Comparison Header',
     description: 'KDP technical comparison table header',
   }
   ```
3. Check [`lib/services/ads/CreativeTemplate.tsx`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/CreativeTemplate.tsx) to verify if the layout handles the new aspect ratio cleanly.
4. Run `npx vitest run lib/services/ads/render.test.ts` to verify image rendering.

### B. Adding a New Design Aesthetic / Palette
1. Open [`lib/services/ads/options.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/options.ts).
2. Add an entry to `TEMPLATES`:
   ```ts
   {
     key: 'cyberpunk',
     label: 'Cyberpunk Neon',
     description: 'High-contrast ultraviolet with electric acid green',
     palette: { background: '#08051a', ink: '#ffffff', accent: '#22c55e', secondary: '#a855f7' },
   }
   ```
3. Update `projectUpdateSchema` to include the new key in `templateKey: z.enum([...])`.
4. Run `npx vitest run lib/services/ads/options.test.ts`.

### C. Adding a New Video Trailer Style or Visual Transition
1. Open [`lib/services/trailer/options.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/trailer/options.ts) and add the style to `STYLE_OPTIONS`.
2. Open [`components/trailer/remotion/BookTrailerComposition.tsx`](file:///home/pratap/work/Publisher_toolkit/components/trailer/remotion/BookTrailerComposition.tsx):
   - Customize background gradients, font weights, particle effects, or spring animations for the new style.
3. Open [`lib/services/trailer/video.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/trailer/video.ts):
   - Add the palette definition to `PALETTES` for headless backend rendering.
4. Run `npx vitest run lib/services/trailer/video.test.ts`.

### D. Verification Gate Before Submitting Changes
Before reporting completion, always run the standard verification gate:
```bash
# 1. Type check
npx tsc --noEmit

# 2. Ads & Core suite tests
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ads_creative_test" npx vitest run lib/services/ads/

# 3. Verify server health
curl -I http://localhost:3000/
```
