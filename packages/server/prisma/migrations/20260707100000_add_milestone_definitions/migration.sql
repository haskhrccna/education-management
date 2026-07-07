-- Roadmap 3.2: generalize the milestone system. evaluateMilestones becomes
-- data-driven against this catalog instead of five hardcoded conditionals.
-- The seed rows below reproduce the exact five existing conditions —
-- zero behavior change for any current user.

DO $$ BEGIN
    CREATE TYPE "MilestoneTriggerType" AS ENUM (
        'SURAH_COUNT', 'REVISION_COUNT', 'STREAK_LENGTH', 'PLAN_COMPLETION', 'IJAZAH_ISSUED', 'HALAQA_ATTENDANCE_COUNT'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "milestone_definitions" (
    "id" TEXT NOT NULL,
    "badgeCode" TEXT NOT NULL,
    "triggerType" "MilestoneTriggerType" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "milestone_definitions_badgeCode_key" ON "milestone_definitions"("badgeCode");

DO $$ BEGIN
    ALTER TABLE "milestone_definitions" ADD CONSTRAINT "milestone_definitions_badgeCode_fkey"
        FOREIGN KEY ("badgeCode") REFERENCES "badges"("code") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

INSERT INTO "milestone_definitions" ("id", "badgeCode", "triggerType", "threshold", "updatedAt") VALUES
  ('mdef_first_surah',  'first_surah_memorized',    'SURAH_COUNT',    1,  CURRENT_TIMESTAMP),
  ('mdef_first_review', 'first_revision_completed', 'REVISION_COUNT', 1,  CURRENT_TIMESTAMP),
  ('mdef_juz_one',      'juz_complete',             'SURAH_COUNT',    30, CURRENT_TIMESTAMP),
  ('mdef_streak_7',     'streak_7',                 'STREAK_LENGTH',  7,  CURRENT_TIMESTAMP),
  ('mdef_streak_30',    'streak_30',                'STREAK_LENGTH',  30, CURRENT_TIMESTAMP)
ON CONFLICT ("badgeCode") DO NOTHING;
