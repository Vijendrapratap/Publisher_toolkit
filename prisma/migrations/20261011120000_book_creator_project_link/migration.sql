-- A written book (BookCreatorProject) gets at most one Ads project root.
ALTER TABLE "Book" ADD COLUMN "creatorProjectId" TEXT;
CREATE UNIQUE INDEX "Book_creatorProjectId_key" ON "Book"("creatorProjectId");
