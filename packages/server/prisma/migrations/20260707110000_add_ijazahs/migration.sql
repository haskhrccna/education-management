-- Roadmap 3.1: ijazah/sanad progress tracking. chainIjazahId is a
-- self-relation building a real chain of transmission when the endorsing
-- teacher's own certifying ijazah is in-system.

DO $$ BEGIN
    CREATE TYPE "IjazahScope" AS ENUM ('SURAH', 'JUZ', 'FULL_QURAN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ijazahs" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "scope" "IjazahScope" NOT NULL,
    "surahId" INTEGER,
    "juzNumber" INTEGER,
    "teacherChainRef" TEXT,
    "chainIjazahId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ijazahs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ijazahs_studentId_idx" ON "ijazahs"("studentId");
CREATE INDEX IF NOT EXISTS "ijazahs_teacherId_idx" ON "ijazahs"("teacherId");

DO $$ BEGIN
    ALTER TABLE "ijazahs" ADD CONSTRAINT "ijazahs_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ijazahs" ADD CONSTRAINT "ijazahs_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ijazahs" ADD CONSTRAINT "ijazahs_surahId_fkey"
        FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ijazahs" ADD CONSTRAINT "ijazahs_chainIjazahId_fkey"
        FOREIGN KEY ("chainIjazahId") REFERENCES "ijazahs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
