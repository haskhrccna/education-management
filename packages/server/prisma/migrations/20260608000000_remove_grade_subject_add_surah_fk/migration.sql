-- Make the app strictly Quran-only.
--
-- The Grade.subject column was a free-text TEXT field that allowed teachers to
-- grade on any subject (e.g. "Mathematics", "Physics", "English") — a
-- non-Quran data path. Replace it with a Surah foreign key so every grade
-- is implicitly Quran-domain by structure, not by label discipline.
--
-- Steps:
--   1. Add the nullable surahId column.
--   2. Best-effort backfill from the student's most-recent COMPLETE
--      MemorizationProgress row, so any pre-existing grades in dev get
--      a sensible default. (In production this is a one-shot data fix
--      and the assignment is reviewed by the deployer.)
--   3. Add the index + foreign key (ON DELETE SET NULL so deleting a Surah
--      doesn't cascade-delete historic grades).
--   4. Drop the legacy subject column.

ALTER TABLE "grades" ADD COLUMN "surahId" INTEGER;

-- Best-effort backfill: pick the first surah the student has completed, if any.
UPDATE "grades" g
SET "surahId" = (
  SELECT mp."surahId"
  FROM "memorization_progress" mp
  WHERE mp."userId" = g."studentId"
    AND mp."status" = 'COMPLETE'
  ORDER BY mp."completedAt" DESC NULLS LAST, mp."updatedAt" DESC
  LIMIT 1
)
WHERE g."surahId" IS NULL;

CREATE INDEX "grades_surahId_idx" ON "grades"("surahId");

ALTER TABLE "grades"
  ADD CONSTRAINT "grades_surahId_fkey"
  FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "grades" DROP COLUMN "subject";
