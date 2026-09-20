-- Video ads replace the cinematic trailer idiom: Amazon Sponsored Brands
-- creative is benefit-led, so the project now stores the ad script and the
-- listing facts the script and the proof beat are built from.
ALTER TABLE "TrailerProject"
  ADD COLUMN "adPreset"    TEXT      NOT NULL DEFAULT 'trade',
  ADD COLUMN "adHeadline"  TEXT,
  ADD COLUMN "adBenefits"  TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "aiScene"     BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "showProof"   BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN "rating"      DOUBLE PRECISION,
  ADD COLUMN "reviewCount" INTEGER,
  ADD COLUMN "price"       TEXT,
  ADD COLUMN "categories"  TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bullets"     TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 30s was a YouTube default; Amazon reports the strongest completion under 20s.
ALTER TABLE "TrailerProject" ALTER COLUMN "length" SET DEFAULT '15s';

-- Books carry the same listing facts so the ads service can reuse an import.
ALTER TABLE "Book"
  ADD COLUMN "price"      TEXT,
  ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bullets"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- A generated cut records which format it is, so the gallery can label them.
ALTER TABLE "GeneratedTrailer"
  ADD COLUMN "preset" TEXT NOT NULL DEFAULT 'trade';
