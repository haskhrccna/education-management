-- Stub architecture for roadmap 1.1 (Recitation Accuracy Scoring) — real
-- ASR/tajweed vendor not yet chosen; these columns exist so the pipeline
-- and teacher UI are fully wired ahead of that decision.

DO $$ BEGIN
    CREATE TYPE "RecordingScoreStatus" AS ENUM ('PENDING', 'SCORED', 'UNAVAILABLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "accuracyScore" DOUBLE PRECISION;
ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "scoreStatus" "RecordingScoreStatus" NOT NULL DEFAULT 'PENDING';
