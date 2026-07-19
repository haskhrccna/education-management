-- Baseline repair: six tables were originally created with `prisma db push`
-- and never captured in the migration ledger, so a fresh database could not
-- be built from migrations alone (fresh `migrate deploy` died on the first
-- dependent ALTER). This backdated, fully idempotent migration creates them
-- in their pre-dependent shapes; later migrations then evolve them:
--   surahs                → 20260627042638 adds "pages"
--   certificates          → 20260707120000 adds verificationToken/active
--   halaqa_rooms          → 20260707130000 adds groupId
--   memorization_progress → referenced by 20260608000000's guarded backfill
--   audit_logs            → 20260507000000 was intentionally emptied; final shape here
--   halaqa_participants   → final shape here
-- Dated before 20260606190000_add_gamification (the earliest guarded
-- dependent that references surahs), so those guards now actually run.

-- surahs (pre-"pages" shape)
CREATE TABLE IF NOT EXISTS "surahs" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "ayahCount" INTEGER NOT NULL,
    "juz" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "surahs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "surahs_number_key" ON "surahs"("number");

-- memorization_progress
DO $$ BEGIN
    CREATE TYPE "MemorizationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "memorization_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahId" INTEGER NOT NULL,
    "status" "MemorizationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "memorizedAyahs" INTEGER NOT NULL DEFAULT 0,
    "lastRecitedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memorization_progress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "memorization_progress_userId_surahId_key" ON "memorization_progress"("userId", "surahId");
CREATE INDEX IF NOT EXISTS "memorization_progress_userId_idx" ON "memorization_progress"("userId");
CREATE INDEX IF NOT EXISTS "memorization_progress_surahId_idx" ON "memorization_progress"("surahId");
DO $$ BEGIN
    ALTER TABLE "memorization_progress" ADD CONSTRAINT "memorization_progress_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TABLE "memorization_progress" ADD CONSTRAINT "memorization_progress_surahId_fkey"
        FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- audit_logs (final shape: userId nullable + SET NULL, per P0 compliance intent)
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
DO $$ BEGIN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- certificates (pre-verificationToken shape; 20260707120000 adds token/active)
CREATE TABLE IF NOT EXISTS "certificates" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "certificates_studentId_idx" ON "certificates"("studentId");
DO $$ BEGIN
    ALTER TABLE "certificates" ADD CONSTRAINT "certificates_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- halaqa_rooms (pre-groupId shape; 20260707130000 adds groupId)
DO $$ BEGIN
    CREATE TYPE "HalaqaStatus" AS ENUM ('WAITING', 'LIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "halaqa_rooms" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "HalaqaStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "halaqa_rooms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "halaqa_rooms_teacherId_status_idx" ON "halaqa_rooms"("teacherId", "status");
CREATE INDEX IF NOT EXISTS "halaqa_rooms_status_createdAt_idx" ON "halaqa_rooms"("status", "createdAt");
DO $$ BEGIN
    ALTER TABLE "halaqa_rooms" ADD CONSTRAINT "halaqa_rooms_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- halaqa_participants (final shape)
CREATE TABLE IF NOT EXISTS "halaqa_participants" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "halaqa_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "halaqa_participants_roomId_userId_key" ON "halaqa_participants"("roomId", "userId");
CREATE INDEX IF NOT EXISTS "halaqa_participants_roomId_idx" ON "halaqa_participants"("roomId");
CREATE INDEX IF NOT EXISTS "halaqa_participants_userId_idx" ON "halaqa_participants"("userId");
DO $$ BEGIN
    ALTER TABLE "halaqa_participants" ADD CONSTRAINT "halaqa_participants_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "halaqa_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TABLE "halaqa_participants" ADD CONSTRAINT "halaqa_participants_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
