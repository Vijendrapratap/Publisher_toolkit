-- AI video: the brief the publisher last generated from, and one row per generation.
ALTER TABLE "Book" ADD COLUMN "aiVideoBrief" JSONB;

CREATE TABLE "AiVideoJob" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "model" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "brief" JSONB NOT NULL,
    "shots" JSONB NOT NULL,
    "videoUrl" TEXT,
    "posterUrl" TEXT,
    "error" TEXT,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiVideoJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiVideoJob_bookId_idx" ON "AiVideoJob"("bookId");

ALTER TABLE "AiVideoJob" ADD CONSTRAINT "AiVideoJob_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
