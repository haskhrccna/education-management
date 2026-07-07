-- Roadmap 2.1: per-ayah weak-spot drilling, scheduled through the existing
-- SM-2 revision_schedule table (a drill is just a revision card with
-- ayahId set, alongside the existing whole-surah cards).

ALTER TABLE "revision_schedule" ADD COLUMN IF NOT EXISTS "ayahId" INTEGER;
CREATE INDEX IF NOT EXISTS "revision_schedule_ayahId_idx" ON "revision_schedule"("ayahId");

DO $$ BEGIN
    ALTER TABLE "revision_schedule" ADD CONSTRAINT "revision_schedule_ayahId_fkey"
        FOREIGN KEY ("ayahId") REFERENCES "ayahs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "WeakAyahStatus" AS ENUM ('ACTIVE', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "weak_ayah_flags" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "ayahId" INTEGER NOT NULL,
    "flaggedByTeacherId" TEXT,
    "status" "WeakAyahStatus" NOT NULL DEFAULT 'ACTIVE',
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weak_ayah_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "weak_ayah_flags_studentId_status_idx" ON "weak_ayah_flags"("studentId", "status");
CREATE INDEX IF NOT EXISTS "weak_ayah_flags_ayahId_idx" ON "weak_ayah_flags"("ayahId");

DO $$ BEGIN
    ALTER TABLE "weak_ayah_flags" ADD CONSTRAINT "weak_ayah_flags_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "weak_ayah_flags" ADD CONSTRAINT "weak_ayah_flags_ayahId_fkey"
        FOREIGN KEY ("ayahId") REFERENCES "ayahs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "weak_ayah_flags" ADD CONSTRAINT "weak_ayah_flags_flaggedByTeacherId_fkey"
        FOREIGN KEY ("flaggedByTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
