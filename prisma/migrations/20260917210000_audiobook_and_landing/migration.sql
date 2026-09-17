-- CreateTable
CREATE TABLE "AudiobookProject" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "blurb" TEXT,
    "pdfUrl" TEXT,
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "ttsProvider" TEXT NOT NULL DEFAULT 'fishaudio',
    "voiceModel" TEXT NOT NULL DEFAULT 'warm-literary',
    "voicePacing" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "audioFormat" TEXT NOT NULL DEFAULT 'mp3',
    "sampleAudioUrl" TEXT,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "fullAudioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudiobookProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudiobookChapter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audioUrl" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudiobookChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingProject" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "author" TEXT,
    "authorBio" TEXT,
    "synopsis" TEXT,
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "template" TEXT NOT NULL DEFAULT 'bestseller',
    "theme" TEXT NOT NULL DEFAULT 'matt',
    "accentColor" TEXT NOT NULL DEFAULT '#6366f1',
    "ctaText" TEXT NOT NULL DEFAULT 'Order Your Copy Today',
    "retailerLinks" JSONB,
    "reviews" JSONB,
    "sampleChapterTitle" TEXT,
    "sampleChapterText" TEXT,
    "publishedSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudiobookProject_publisherId_idx" ON "AudiobookProject"("publisherId");

-- CreateIndex
CREATE INDEX "AudiobookChapter_projectId_idx" ON "AudiobookChapter"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingProject_publishedSlug_key" ON "LandingProject"("publishedSlug");

-- CreateIndex
CREATE INDEX "LandingProject_publisherId_idx" ON "LandingProject"("publisherId");

-- AddForeignKey
ALTER TABLE "AudiobookChapter" ADD CONSTRAINT "AudiobookChapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AudiobookProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
