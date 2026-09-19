# Publisher Toolkit — Comprehensive Platform Architecture & Feature Engineering Guide

This document is the definitive technical manual for the **Publisher Toolkit**. It details the platform philosophy, system architecture, data flows, core feature implementations, data models, and provides step-by-step recipes for developers to maintain and extend the codebase.

---

## Table of Contents
1. [Platform Overview & Philosophy](#1-platform-overview--philosophy)
2. [Master Architecture Diagrams](#2-master-architecture-diagrams)
   - [2.1 System Topology & Infrastructure](#21-system-topology--infrastructure)
   - [2.2 End-to-End Asset Generation Lifecycle](#22-end-to-end-asset-generation-lifecycle)
   - [2.3 Client-Side Component Hierarchy](#23-client-side-component-hierarchy)
   - [2.4 Storage & Asset Delivery Architecture](#24-storage--asset-delivery-architecture)
3. [Deep-Dive Feature Specifications](#3-deep-dive-feature-specifications)
   - [Feature 1: Book Ingestion & Metadata Extraction](#feature-1-book-ingestion--metadata-extraction)
   - [Feature 2: Amazon Ads & KDP A+ Content Suite](#feature-2-amazon-ads--kdp-a-content-suite)
   - [Feature 3: Remotion & Hyperframes Video Trailer Studio](#feature-3-remotion--hyperframes-video-trailer-studio)
   - [Feature 4: AI Audiobook Studio & Voice Synthesis](#feature-4-ai-audiobook-studio--voice-synthesis)
   - [Feature 5: High-Converting Book Landing Page Studio](#feature-5-high-converting-book-landing-page-studio)
   - [Feature 6: Amazon Launch Hub & 1-Click Packaging](#feature-6-amazon-launch-hub--1-click-packaging)
   - [Feature 7: Publisher Imprint & Brand Profile Settings](#feature-7-publisher-imprint--brand-profile-settings)
4. [Prisma Data Models & Entity Relationships](#4-prisma-data-models--entity-relationships)
5. [API Routes & Contracts Directory](#5-api-routes--contracts-directory)
6. [Developer Playbook: How to Extend & Make Changes](#6-developer-playbook-how-to-extend--make-changes)
   - [How to Add a New Amazon Ad / A+ Format](#how-to-add-a-new-amazon-ad--a-format)
   - [How to Add a New Visual Design Theme](#how-to-add-a-new-visual-design-theme)
   - [How to Add a New Video Motion Style or Visual Transition](#how-to-add-a-new-video-motion-style-or-visual-transition)
   - [How to Add a New TTS Voice Model or Audio Provider](#how-to-add-a-new-tts-voice-model-or-audio-provider)
   - [Testing & Quality Assurance Gate](#testing--quality-assurance-gate)

---

## 1. Platform Overview & Philosophy

The **Publisher Toolkit** is an autonomous marketing and media production operating system for authors, independent publishers, and digital publishing imprints. 

### The Problem
Publishers and authors lose hundreds of hours manually designing Amazon A+ Content banners, producing promotional book trailers, formatting marketing copy, rendering audio chapters, and creating book landing pages. High-end video production requires costly motion designers, and graphic design tools produce static banners that fail to meet strict Amazon KDP specifications.

### The Solution
Publisher Toolkit transforms a single manuscript (PDF) or book cover into a **complete, launch-ready commercial kit** within seconds:
- **Zero-Friction Ingestion**: Automatic heuristic extraction of title, author, blurb, and cover artwork directly from book files.
- **Amazon KDP & AMS Native**: Pixel-perfect generation of Amazon A+ Content modules (970×600 Hero, 970×300 Feature, 300×300 Quad Module) and Amazon Sponsored Banners (300×250, 1200×628).
- **Cinematic Motion Quality**: Real-time browser preview with Remotion and 1080p server rendering featuring 3D book depth, specular light catchlights, kinetic typography, and audio synchronization.
- **Zero Speculative Bloat (Ponytail Senior Dev Architecture)**: Reuses native browser APIs, Satori layouts, standard node modules, and clean PostgreSQL schema models without unnecessary external SaaS dependencies.

---

## 2. Master Architecture Diagrams

### 2.1 System Topology & Infrastructure

```mermaid
flowchart TD
    subgraph ClientBrowser["Client Web Browser (Chrome / Safari / Firefox)"]
        UI_Shell["Next.js Layout & Studio Shell"]
        UI_Ads["Amazon Ads & A+ Studio (/ads)"]
        UI_Trailer["Video Trailer Studio (/trailer)"]
        UI_Audio["Audiobook Studio (/audiobook)"]
        UI_Landing["Landing Page Studio (/landing)"]
        UI_RemotionPlayer["Remotion Player Engine (Client-Side Canvas/WebGL)"]
    end

    subgraph AppRouter["Next.js 15 Server Runtime (Node.js Environment)"]
        subgraph APIRoutes["REST API & Action Layer (/api/*)"]
            API_Projects["/api/ads/projects (CRUD & Configure)"]
            API_Generate["/api/ads/projects/[id]/generate (Batch Runner)"]
            API_Download["/api/ads/projects/[id]/download (ZIP Streamer)"]
            API_TrailerProjects["/api/trailer/projects (Video Engine)"]
            API_AudioProjects["/api/audiobook/projects (TTS Engine)"]
            API_Files["/api/files/[...path] (Auth Scoped File Stream)"]
        end

        subgraph CoreEngines["Specialized Production Engines"]
            ENG_Extract["PDF Ingestion & Cover Rasterizer (unpdf / pdfjs-dist)"]
            ENG_Copy["AI Copywriter (Vercel AI SDK + OpenRouter)"]
            ENG_Satori["Satori Canvas Image Renderer (React JSX to PNG)"]
            ENG_Video["Headless Video Synthesizer (@napi-rs/canvas + FFmpeg)"]
            ENG_TTS["Audiobook Synthesizer (Fish Audio / Kokoro Models)"]
            ENG_Packaging["JSZip Campaign Packager (Multi-Asset Bundler)"]
        end

        subgraph SecurityAuth["Security & Authentication"]
            AUTH_Cookie["Publisher Session Cookie (UUID Scoped)"]
            AUTH_Guard["requireCurrentPublisherId Guard"]
        end
    end

    subgraph DataStorage["Data & Asset Persistence Layer"]
        DB[(PostgreSQL Database via Prisma ORM)]
        STORAGE["Storage Provider Abstraction (Local Disk / Vercel Blob)"]
    end

    UI_Shell --> APIRoutes
    UI_RemotionPlayer -.->|Live Canvas State| UI_Ads
    APIRoutes --> SecurityAuth
    APIRoutes --> CoreEngines
    CoreEngines --> DataStorage
    APIRoutes --> DataStorage
```

---

### 2.2 End-to-End Asset Generation Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Publisher as Publisher / Author
    participant Browser as Client Browser
    participant API as Next.js API Routes
    participant PDFEngine as PDF Extraction Service
    participant OpenRouter as LLM Copy Engine
    participant Satori as Satori / Canvas Engine
    participant VideoEngine as Remotion / FFmpeg Video Engine
    participant Storage as File Storage Provider
    participant DB as PostgreSQL (Prisma)

    Publisher->>Browser: Selects PDF or enters book details
    Browser->>API: POST /api/ads/projects (FormData)
    API->>Storage: Persist uploaded PDF / Cover
    API->>PDFEngine: Parse metadata & rasterize covers
    PDFEngine-->>API: { title, author, blurb, frontCoverUrl, backCoverUrl }
    API->>DB: INSERT Book (status: 'uploaded')
    API-->>Browser: Redirect to /ads/[id]/configure

    Publisher->>Browser: Selects Objective, Copy Tone, Template & Video Options
    Browser->>Browser: Renders instant Remotion Live Preview
    Publisher->>Browser: Clicks "Generate Amazon Creatives & Video"
    Browser->>API: POST /api/ads/projects/[id]/generate

    par Parallel Generation Execution
        API->>OpenRouter: Prompt LLM for Amazon Copy & Hooks
        OpenRouter-->>API: Headline, Primary Text, Description
    and
        API->>Satori: Render Amazon A+ & Sponsored Modules (970x600, 970x300, 300x300, 300x250, 1200x628)
        Satori-->>API: High-Resolution PNG Buffers
    and
        opt If Video Enabled
            API->>VideoEngine: Render 4-Scene Video with Specular Catchlights
            VideoEngine-->>API: 1080p MP4 Buffer & Poster PNG Buffer
        end
    end

    API->>Storage: Store all PNGs, MP4, and Poster
    API->>DB: INSERT CreativeSet, AdCopies, CreativeImages
    API->>DB: UPDATE Book (status: 'generated')
    API-->>Browser: HTTP 201 { creativeSetId }
    Browser-->>Publisher: Displays Interactive Gallery & Amazon Launch Hub

    Publisher->>Browser: Clicks "Download Complete Kit (.zip)"
    Browser->>API: GET /api/ads/projects/[id]/download
    API->>Storage: Retrieve all generated assets
    API-->>Browser: Streams Complete ZIP file (A+ banners, MP4 video, copy.txt)
```

---

### 2.3 Client-Side Component Hierarchy

```mermaid
flowchart TD
    RootLayout["Root Layout (app/layout.tsx)"]
    StudioLayout["Platform Studio Shell (app/(platform)/layout.tsx)"]
    AccountChip["AccountChip & Studio Settings Quick Menu"]

    RootLayout --> StudioLayout
    StudioLayout --> AccountChip

    subgraph AdsPipeline["Amazon Ads & A+ Suite (/ads)"]
        AdsNew["New Project Page (/ads/new)"]
        NewProjectForm["NewProjectForm (PDF Upload / Library Picker)"]
        AdsConfig["Configure Page (/ads/[id]/configure)"]
        ConfigureForm["ConfigureForm (Objective, Tone, Palette, Video Params)"]
        RemotionPreview["TrailerLivePreviewPlayer (Embedded Remotion Player)"]
        AdsGenerate["Generate Page (/ads/[id]/generate)"]
        GenerateRunner["GenerateRunner (Progress Polling & SSE)"]
        AdsResults["Results Page (/ads/[id]/results)"]
        CreativeGallery["CreativeGallery (Tabs, Zoom Modal, Individual Downloads)"]
        CopyEditor["CopyEditor (Live Inline Copy Editing)"]
        AmazonLaunchHub["AmazonPackagePanel (Checklist, 1-Click ZIP, KDP Direct Links)"]
    end

    subgraph VideoPipeline["Dedicated Trailer Studio (/trailer)"]
        TrailerNew["New Trailer Page (/trailer/new)"]
        TrailerConfig["TrailerConfigureForm"]
        TrailerPlayer["TrailerPlayerGallery"]
    end

    subgraph AudiobookPipeline["Audiobook Studio (/audiobook)"]
        AudiobookNew["New Audiobook Page (/audiobook/new)"]
        AudiobookConfig["AudiobookConfigureForm"]
        AudiobookGallery["AudiobookPlayerGallery (Chapter Streaming & Player)"]
    end

    StudioLayout --> AdsNew --> NewProjectForm
    StudioLayout --> AdsConfig --> ConfigureForm --> RemotionPreview
    StudioLayout --> AdsGenerate --> GenerateRunner
    StudioLayout --> AdsResults --> CreativeGallery
    AdsResults --> CopyEditor
    AdsResults --> AmazonLaunchHub

    StudioLayout --> TrailerNew --> TrailerConfig --> TrailerPlayer
    StudioLayout --> AudiobookNew --> AudiobookConfig --> AudiobookGallery
```

---

### 2.4 Storage & Asset Delivery Architecture

All files uploaded or generated within the platform are managed by a centralized abstraction in [`lib/providers/storage.ts`](file:///home/pratap/work/Publisher_toolkit/lib/providers/storage.ts):

```mermaid
flowchart LR
    Caller["API Handler / Background Engine"] -->|storeFile(path, buffer, mime)| StorageEngine{"Storage Provider Selector"}
    StorageEngine -->|BLOB_READ_WRITE_TOKEN Set| VercelBlobProvider["Vercel Blob Storage Provider"]
    StorageEngine -->|Token Not Set (Local Mode)| LocalDiskProvider["Local Filesystem Storage Provider"]

    LocalDiskProvider -->|Writes to disk| LocalDisk["Local Disk (/public/uploads or os.tmpdir)"]
    VercelBlobProvider -->|Uploads via API| VercelCDN["Vercel Global Edge CDN"]

    ClientReq["Client Browser Request"] -->|GET /api/files/...| AuthProxy["/api/files/[...path] Auth Proxy"]
    AuthProxy -->|Verify Publisher Ownership| LocalDisk
    AuthProxy -->|Stream Bytes with Content-Type| ClientReq
    ClientReq -.->|Direct CDN Access| VercelCDN
```

---

## 3. Deep-Dive Feature Specifications

---

### Feature 1: Multi-Modal Ingestion & Creatify-Style Product URL Scraper

#### Purpose & Business Value
Eliminates manual typing, cover exporting, and tedious file uploading. Authors and publishers can create complete promotional packages simply by pasting an Amazon KDP, bookstore, or Goodreads URL, or uploading their cover artwork alongside 2–5 interior page illustrations without needing a full-book PDF.

#### Supported Ingestion Channels
1. **🔗 Creatify-Style Product Link Auto-Fetcher** (`/api/extract-url`):
   - Publishers paste an Amazon book listing (e.g. `https://www.amazon.com/dp/...`), bookstore, or Goodreads URL.
   - The engine automatically fetches HTML, bypasses common store bot shields with realistic headers, and extracts:
     * High-resolution book cover artwork (downloaded and permanently stored via `storeFile`).
     * Book Title & Subtitle.
     * Author Name & Attributions.
     * Book Description & Synopsis blurb.
     * Amazon Star Ratings (e.g. ⭐ 4.8 / 5) and Customer Review Counts (e.g. 1,420 reviews).
2. **🖼️ Lightweight Asset Upload (No PDF Required)**:
   - Front cover image (PNG, JPG, WebP up to 10MB).
   - Optional back cover image.
   - **2–5 Interior Page Images & Illustrations**: Chapter openers, character art, fantasy maps, or excerpt spreads. These are featured in A+ module spreads and video trailer scene reveals.
3. **📚 Studio Library Picker**:
   - Re-use previously uploaded or generated books without re-entering metadata or re-uploading assets.
4. **📄 Full Manuscript PDF Upload (Optional)**:
   - Automatic extraction via `unpdf` and `pdfjs-dist` for publishers who prefer uploading a complete interior manuscript file.

#### Key Files
- URL Extractor Service: [`lib/services/extract/urlExtractor.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/extract/urlExtractor.ts)
- URL Extraction API: [`app/api/extract-url/route.ts`](file:///home/pratap/work/Publisher_toolkit/app/api/extract-url/route.ts)
- Reusable Interior Dropzone: [`components/platform/InteriorImagesDropzone.tsx`](file:///home/pratap/work/Publisher_toolkit/components/platform/InteriorImagesDropzone.tsx)
- PDF Extraction Engine: [`lib/services/ads/extract.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/extract.ts)
- Ads Ingestion Form: [`components/ads/NewProjectForm.tsx`](file:///home/pratap/work/Publisher_toolkit/components/ads/NewProjectForm.tsx)
- Trailer Ingestion Form: [`components/trailer/NewTrailerProjectForm.tsx`](file:///home/pratap/work/Publisher_toolkit/components/trailer/NewTrailerProjectForm.tsx)

---

### Feature 2: Amazon Ads & KDP A+ Content Suite with Goal-Driven Intent

#### Purpose & Business Value
Independent authors and publishers need to look professional on Amazon to drive conversions. The creation flow starts with a goal-driven intent selector:
1. **Full Amazon Launch Bundle (`all`)**: Complete suite including A+ Modules, Video Trailer, Sponsored Ads, and Copy.
2. **Amazon A+ Content Suite (`aplus`)**: Tailored specifically for Enhanced Brand Content listing modules.
3. **Amazon Video Trailer (`video`)**: Remotion HD trailers for product pages and social media.
4. **Sponsored Display & Banners (`sponsored`)**: High-CTR advertising banners for AMS campaigns.

#### Supported Specifications
| Size Key | Width | Height | Placement Name | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `amazon_aplus_banner_970x600` | 970 px | 600 px | Standard Image Header | Hero brand module at top of Amazon product page |
| `amazon_aplus_feature_970x300` | 970 px | 300 px | Standard Technical / Feature | Showcase plot hooks, worldbuilding, and praise |
| `amazon_aplus_square_300x300` | 300 px | 300 px | Standard Quad Module | Character cards, series list, or thematic icons |
| `amazon_300x250` | 300 px | 250 px | Sponsored Display Banner | Kindle Lockscreen, product page sidebars, checkout |
| `amazon_1200x628` | 1200 px | 628 px | Sponsored Brands Headline | Top-of-search headline banner with author logo |

#### Key Files
- Size Definitions: [`lib/services/ads/sizes.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/sizes.ts)
- Visual Design Engine: [`lib/services/ads/CreativeTemplate.tsx`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/CreativeTemplate.tsx)
- Image Rendering Pipeline: [`lib/services/ads/render.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/render.ts)
- AI Copy Generator: [`lib/services/ads/copy.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/copy.ts)
- Visual Gallery Component: [`components/ads/CreativeGallery.tsx`](file:///home/pratap/work/Publisher_toolkit/components/ads/CreativeGallery.tsx)

#### Design Aesthetics & Templates
The system supports 8 curated design aesthetics:
1. **Classic Editorial**: Dark and elegant, warm amber serif typography.
2. **Bold Pop & Buzz**: High-energy saturated crimson berry with gold accents.
3. **Clean Minimalist**: Ivory white background, platinum grays, generous breathing room.
4. **Cinematic Noir**: Obsidian black with neon cyan suspense elements.
5. **Mythic Fantasy**: Midnight royal indigo with luminous starlight gold.
6. **Velvet Romance**: Deep burgundy wine with emotional rose gold highlights.
7. **Vintage Parchment**: Aged sepia paper, rich espresso ink, brass warmth.
8. **Speculative Sci-Fi**: Deep void black with electric neon cyan HUD accents.

#### Responsive Ratio Adaptation
Wide banners (e.g. 970×300 and 970×600) automatically detect `width / height >= 1.5` in `CreativeTemplate.tsx`. Instead of stacking vertically, the layout switches to a balanced horizontal split:
- **Left Column**: Book cover with realistic drop shadow and 3D border perspective.
- **Right Column**: Campaign badge (e.g. `NEW RELEASE`), high-contrast title in Fraunces serif, author tagline, and primary CTA button.

---

### Feature 3: Remotion & Hyperframes Video Trailer Studio

#### Purpose & Business Value
Amazon Sponsored Brands Video ads have the highest click-through and purchase conversion rate of any Amazon advertising format. This feature generates studio-grade 1080p promotional video trailers with dynamic catchlights, kinetic typography, and 3D cover depth.

#### Key Files
- Browser Remotion Player: [`components/trailer/TrailerLivePreviewPlayer.tsx`](file:///home/pratap/work/Publisher_toolkit/components/trailer/TrailerLivePreviewPlayer.tsx)
- Remotion Composition: [`components/trailer/remotion/BookTrailerComposition.tsx`](file:///home/pratap/work/Publisher_toolkit/components/trailer/remotion/BookTrailerComposition.tsx)
- Server Headless Video Engine: [`lib/services/trailer/video.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/trailer/video.ts)

#### 4-Scene Cinematic Narrative Architecture
Each video is structured into 4 narrative beats:
1. **Scene 1: The Hook** (0–2.5s)
   - Atmospheric particles (golden embers for fantasy, scanlines for sci-fi, bokeh for romance).
   - High-impact hook text animated with Remotion `spring()` physics.
2. **Scene 2: Story Excerpt** (2.5–5.0s)
   - Emotional synopsis blurb teaser with smooth opacity transitions.
3. **Scene 3: 3D Book Reveal** (5.0–7.5s)
   - **Hyperframe Specular Sheen**: Sweeping linear lighting gradient across the cover varnish.
   - 3D physical book rendering with page block thickness and spine depth shadow.
4. **Scene 4: Call to Action & Retail Outro** (7.5–10.0s)
   - Book title, author name, retailer badge ("Available on Amazon & Kindle"), and call to action.

#### Headless Server Pipeline
On the server side (in `/api/ads/projects/[id]/generate` and `/api/trailer/projects/[id]/generate`), the system executes:
1. High-resolution canvas scene generation using `@napi-rs/canvas`.
2. Scene frames written to a secure temporary directory.
3. High-efficiency FFmpeg stitching:
   ```bash
   ffmpeg -loop 1 -t 2.5 -i s1.png ... -filter_complex "[0:v]fade=...[v0]; ... concat" -c:v libx264 -pix_fmt yuv420p output.mp4
   ```
4. Output MP4 and poster image stored to storage provider and associated with `CreativeSet`.

---

### Feature 4: AI Audiobook Studio & Voice Synthesis

#### Purpose & Business Value
Empowers publishers to turn their manuscript into serialized audiobooks with automated chapter segmentation, custom narration pacing, and character-driven voice models.

#### Key Files
- Chapter Segmentation: [`lib/services/audiobook/chapterParser.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/audiobook/chapterParser.ts)
- TTS Generation Engine: [`lib/services/audiobook/tts.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/audiobook/tts.ts)
- Audio Player & Streaming Gallery: [`components/audiobook/AudiobookPlayerGallery.tsx`](file:///home/pratap/work/Publisher_toolkit/components/audiobook/AudiobookPlayerGallery.tsx)

#### Technical Workflow
1. **Chapter Extraction**: Parses PDF text using regex patterns detecting:
   - `Chapter 1`, `Chapter One`, `CHAPTER I`
   - `Prologue`, `Epilogue`, `Introduction`
   - Custom numbered section headers.
2. **Voice Synthesis Engines**:
   - **Fish Audio** (`fishaudio`): Expressive neural voice model.
   - **Kokoro** (`kokoro`): Fast, lightweight literary TTS model.
   - **Simulated Engine**: Fallback for local testing without external API keys.
3. **Audio Controls**: Configurable playback speed multiplier (`0.8x` to `1.3x`), audio format selection (`mp3` / `wav`), and chapter-by-chapter streaming.

---

### Feature 5: High-Converting Book Landing Page Studio

#### Purpose & Business Value
Provides a dedicated promotional website for book launches, pre-orders, and author branding with zero hosting setup required.

#### Key Files
- Agent Logic: [`lib/services/landing/agent.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/landing/agent.ts)
- Standalone HTML Renderer: [`lib/services/landing/renderer.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/landing/renderer.ts)
- ZIP Export Service: [`lib/services/landing/zip.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/landing/zip.ts)

#### Output Format
Generates a 1-click downloadable ZIP archive containing:
- `index.html`: Modern, accessible, semantic HTML5 structure with Open Graph metadata and Schema.org Book markup.
- `styles.css`: Self-contained, responsive modern CSS with dark/light theme support and fluid typography.
- `cover.png`: High-resolution book cover asset.
- `README.md`: Deployment instructions for Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

---

### Feature 6: Amazon Launch Hub & 1-Click Packaging

#### Purpose & Business Value
Eliminates confusion on how to deploy generated assets to Amazon. Instead of downloading files piecemeal, publishers get an organized master bundle and instant launch guidance.

#### Key Files
- Panel Component: [`components/ads/AmazonPackagePanel.tsx`](file:///home/pratap/work/Publisher_toolkit/components/ads/AmazonPackagePanel.tsx)
- ZIP Bundler: [`lib/services/ads/zip.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/zip.ts)
- Download Route: [`app/api/ads/projects/[id]/download/route.ts`](file:///home/pratap/work/Publisher_toolkit/app/api/ads/projects/[id]/download/route.ts)

#### Packaging Structure
The downloaded `.zip` file is organized as follows:
```
my-book-ad-creatives.zip
├── amazon/
│   ├── amazon_aplus_banner_970x600.png
│   ├── amazon_aplus_feature_970x300.png
│   ├── amazon_aplus_square_300x300.png
│   ├── amazon_300x250.png
│   ├── amazon_1200x628.png
│   ├── video-trailer.mp4
│   └── video-poster.png
└── copy.txt
```

#### Launch Hub Capabilities
- **1-Click ZIP Download**: Bundles all images, video MP4, poster, and copy text into one archive.
- **1-Click Copy to Clipboard**: Formats headline, primary text, and description ready to paste into Amazon Advertising Console.
- **Direct Links**: Direct buttons to open **KDP A+ Content Manager** and **Amazon Advertising Console**.

---

### Feature 7: Publisher Imprint & Brand Profile Settings

#### Purpose & Business Value
Allows publishers and imprints to store their global brand parameters so they are automatically inherited across all newly created books and ad campaigns.

#### Key Files
- Settings Page: [`app/(platform)/settings/page.tsx`](file:///home/pratap/work/Publisher_toolkit/app/(platform)/settings/page.tsx)
- Settings Form Component: [`components/platform/SettingsForm.tsx`](file:///home/pratap/work/Publisher_toolkit/components/platform/SettingsForm.tsx)
- Settings Data Service: [`lib/publisher/settings.ts`](file:///home/pratap/work/Publisher_toolkit/lib/publisher/settings.ts)

#### Configurable Brand Parameters
- **Publisher Imprint**: Imprint name, logo, primary website, support email.
- **Visual Tokens**: Primary brand accent color, serif vs. sans-serif typography preference.
- **Retail Links**: Default Amazon Author Central link, KDP Storefront URL, and retailer tags.
- **Defaults**: Default copy tone and campaign objectives.

---

## 4. Prisma Data Models & Entity Relationships

The data layer is managed with Prisma ORM targeting PostgreSQL.

```mermaid
erDiagram
    Publisher ||--o{ Book : "owns"
    Publisher ||--o{ TrailerProject : "owns"
    Publisher ||--o{ AudiobookProject : "owns"
    Publisher ||--o{ LandingProject : "owns"

    Book ||--o{ CreativeSet : "has many"
    Book ||--o{ Book : "parent / child library copies"

    CreativeSet ||--o{ AdCopy : "has many"
    CreativeSet ||--o{ CreativeImage : "has many"

    TrailerProject ||--o{ GeneratedTrailer : "renders"
    AudiobookProject ||--o{ AudiobookChapter : "contains"

    Publisher {
        string id PK
        string name
        string email
        json settings
        datetime createdAt
        datetime updatedAt
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
        datetime createdAt
        datetime updatedAt
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
```

---

## 5. API Routes & Contracts Directory

| Endpoint | Method | Purpose | Request Payload | Response |
| :--- | :--- | :--- | :--- | :--- |
| `/api/ads/projects` | `GET` | List all books for authenticated publisher | None | `Book[]` |
| `/api/ads/projects` | `POST` | Ingest manuscript/cover & extract metadata | `multipart/form-data` | `{ id: string }` |
| `/api/ads/projects/[id]` | `PATCH` | Update campaign options & video configuration | `JSON (projectUpdateSchema)` | `{ id: string }` |
| `/api/ads/projects/[id]/generate` | `POST` | Trigger concurrent copy, image & video generation | None | `{ creativeSetId: string }` |
| `/api/ads/projects/[id]/download` | `GET` | Download full campaign bundle as `.zip` | None | Binary `.zip` stream |
| `/api/creatives/[id]/image` | `GET` | Authenticated creative image stream / download | Query: `?download=1` | PNG image stream |
| `/api/trailer/projects` | `POST` | Create standalone video trailer project | `JSON` or `FormData` | `{ id: string }` |
| `/api/trailer/projects/[id]/generate` | `POST` | Render video trailer via headless canvas + ffmpeg | None | `{ trailerId: string }` |
| `/api/audiobook/projects` | `POST` | Ingest book & parse audiobook chapters | `FormData` | `{ id: string }` |
| `/api/audiobook/projects/[id]/generate` | `POST` | Generate chapter audio via TTS engine | None | `{ fullAudioUrl: string }` |
| `/api/landing/projects/[id]/generate` | `POST` | Generate promotional landing page | None | `{ html: string }` |
| `/api/files/[...path]` | `GET` | Securely stream stored asset for authorized session | Path params | Binary stream with mime |

---

## 6. Developer Playbook: How to Extend & Make Changes

### How to Add a New Amazon Ad / A+ Format
1. Open [`lib/services/ads/sizes.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/sizes.ts).
2. Add your specification to `CREATIVE_SIZES`:
   ```ts
   {
     key: 'amazon_aplus_comparison_970x150',
     platform: 'AMAZON',
     width: 970,
     height: 150,
     label: 'A+ Product Comparison Table',
     description: 'Standard technical comparison banner for KDP',
   }
   ```
3. Update [`lib/services/ads/CreativeTemplate.tsx`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/CreativeTemplate.tsx) to verify the layout adapts cleanly to the new aspect ratio.
4. Update metadata in [`components/ads/CreativeGallery.tsx`](file:///home/pratap/work/Publisher_toolkit/components/ads/CreativeGallery.tsx) so the format displays with the proper badge.
5. Verify with `npx vitest run lib/services/ads/render.test.ts`.

---

### How to Add a New Visual Design Theme
1. Open [`lib/services/ads/options.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/ads/options.ts).
2. Add a new theme definition to `TEMPLATES`:
   ```ts
   {
     key: 'gothic',
     label: 'Gothic Mystery',
     description: 'Deep midnight charcoal with crimson velvet accents',
     palette: { background: '#0a0508', ink: '#ffffff', accent: '#e11d48', secondary: '#240a15' },
   }
   ```
3. Update `projectUpdateSchema` to include the new key in the `templateKey` enum.
4. Verify with `npx vitest run lib/services/ads/options.test.ts`.

---

### How to Add a New Video Motion Style or Visual Transition
1. Open [`lib/services/trailer/options.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/trailer/options.ts) and add the style to `STYLE_OPTIONS`.
2. Open [`components/trailer/remotion/BookTrailerComposition.tsx`](file:///home/pratap/work/Publisher_toolkit/components/trailer/remotion/BookTrailerComposition.tsx):
   - Add the specific particle animations, color grading, or spring timing for the new style.
3. Open [`lib/services/trailer/video.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/trailer/video.ts):
   - Add the palette definition to `PALETTES` for headless backend rendering.
4. Verify with `npx vitest run lib/services/trailer/video.test.ts`.

---

### How to Add a New TTS Voice Model or Audio Provider
1. Open [`lib/services/audiobook/options.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/audiobook/options.ts) and add the new model key to `VOICE_MODELS` or `TTS_PROVIDERS`.
2. Open [`lib/services/audiobook/tts.ts`](file:///home/pratap/work/Publisher_toolkit/lib/services/audiobook/tts.ts):
   - Implement the provider request handler calling the model's API.
3. Verify with `npx vitest run lib/services/audiobook/tts.test.ts`.

---

### Testing & Quality Assurance Gate
Before committing any changes, run the mandatory verification gate:
```bash
# 1. Type check
npx tsc --noEmit

# 2. Ads test suite
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ads_creative_test" npx vitest run lib/services/ads/

# 3. Video engine test suite
npx vitest run lib/services/trailer/

# 4. Audiobook suite
npx vitest run lib/services/audiobook/

# 5. Check local dev server health
curl -I http://localhost:3000/
```
