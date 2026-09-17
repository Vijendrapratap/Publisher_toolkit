-- CreateTable
CREATE TABLE "TrailerProject" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "blurb" TEXT,
    "pdfUrl" TEXT,
    "frontCoverUrl" TEXT,
    "backCoverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "length" TEXT NOT NULL DEFAULT '30s',
    "style" TEXT NOT NULL DEFAULT 'cinematic',
    "musicMood" TEXT NOT NULL DEFAULT 'suspenseful',
    "aspectRatios" TEXT[] DEFAULT ARRAY['9:16', '1:1', '16:9']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrailerProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedTrailer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedTrailer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrailerProject_publisherId_idx" ON "TrailerProject"("publisherId");

-- CreateIndex
CREATE INDEX "GeneratedTrailer_projectId_idx" ON "GeneratedTrailer"("projectId");

-- AddForeignKey
ALTER TABLE "GeneratedTrailer" ADD CONSTRAINT "GeneratedTrailer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrailerProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
