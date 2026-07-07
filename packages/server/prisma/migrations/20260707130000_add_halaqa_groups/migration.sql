-- Roadmap 3.4: a persistent, named halaqa that individual HalaqaRoom
-- sessions belong to, carrying a collective attendance streak.

CREATE TABLE IF NOT EXISTS "halaqa_groups" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "attendanceThreshold" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halaqa_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "halaqa_groups_teacherId_idx" ON "halaqa_groups"("teacherId");

DO $$ BEGIN
    ALTER TABLE "halaqa_groups" ADD CONSTRAINT "halaqa_groups_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "halaqa_rooms" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

DO $$ BEGIN
    ALTER TABLE "halaqa_rooms" ADD CONSTRAINT "halaqa_rooms_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "halaqa_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
