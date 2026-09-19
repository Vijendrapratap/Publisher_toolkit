-- AlterTable
ALTER TABLE "Book" ADD COLUMN "campaignName" TEXT DEFAULT 'Main Campaign',
ADD COLUMN "campaignObjective" TEXT DEFAULT 'launch',
ADD COLUMN "targetAudience" TEXT,
ADD COLUMN "customHook" TEXT,
ADD COLUMN "ctaText" TEXT DEFAULT 'Order Your Copy Today',
ADD COLUMN "parentBookId" TEXT;

-- CreateIndex
CREATE INDEX "Book_parentBookId_idx" ON "Book"("parentBookId");

-- AlterTable
ALTER TABLE "CreativeSet" ADD COLUMN "campaignName" TEXT,
ADD COLUMN "campaignObjective" TEXT,
ADD COLUMN "templateKey" TEXT;
