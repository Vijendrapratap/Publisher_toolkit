-- Only one AI video job can be in flight per book at a time. Prisma's schema
-- language cannot express a partial index, so the constraint lives here only
-- (see the comment on model AiVideoJob in schema.prisma).
CREATE UNIQUE INDEX "AiVideoJob_one_active_per_book" ON "AiVideoJob"("bookId") WHERE "status" IN ('running', 'stitching');
