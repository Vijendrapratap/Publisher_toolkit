-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "blurb" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "frontCoverUrl" TEXT,
    "backCoverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeSet" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCopy" (
    "id" TEXT NOT NULL,
    "creativeSetId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "AdCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeImage" (
    "id" TEXT NOT NULL,
    "creativeSetId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sizeKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,

    CONSTRAINT "CreativeImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Book_publisherId_idx" ON "Book"("publisherId");

-- CreateIndex
CREATE INDEX "CreativeSet_bookId_idx" ON "CreativeSet"("bookId");

-- CreateIndex
CREATE INDEX "AdCopy_creativeSetId_idx" ON "AdCopy"("creativeSetId");

-- CreateIndex
CREATE INDEX "CreativeImage_creativeSetId_idx" ON "CreativeImage"("creativeSetId");

-- AddForeignKey
ALTER TABLE "CreativeSet" ADD CONSTRAINT "CreativeSet_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCopy" ADD CONSTRAINT "AdCopy_creativeSetId_fkey" FOREIGN KEY ("creativeSetId") REFERENCES "CreativeSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeImage" ADD CONSTRAINT "CreativeImage_creativeSetId_fkey" FOREIGN KEY ("creativeSetId") REFERENCES "CreativeSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
