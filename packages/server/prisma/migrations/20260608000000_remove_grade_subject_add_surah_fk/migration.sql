DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'grades')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'surahs')
  THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'grades' AND column_name = 'surahId') THEN
      ALTER TABLE "grades" ADD COLUMN "surahId" INTEGER;
    END IF;

    -- Best-effort backfill: pick the first surah the student has completed, if any.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'memorization_progress') THEN
      UPDATE "grades" g
      SET "surahId" = (
        SELECT mp."surahId"
        FROM "memorization_progress" mp
        WHERE mp."userId" = g."studentId" AND mp."status" = 'COMPLETE'
        ORDER BY mp."updatedAt" DESC
        LIMIT 1
      )
      WHERE g."surahId" IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'grades' AND column_name = 'subject') THEN
      -- subject already dropped, nothing to do
      NULL;
    ELSE
      CREATE INDEX IF NOT EXISTS "grades_surahId_idx" ON "grades"("surahId");
      ALTER TABLE "grades" DROP CONSTRAINT IF EXISTS "grades_subject_check";
      ALTER TABLE "grades" DROP COLUMN IF EXISTS "subject";
    END IF;
  END IF;
END $$;
