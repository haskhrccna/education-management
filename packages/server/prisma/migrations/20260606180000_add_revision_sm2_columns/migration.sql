-- Phase 4: SM-2 spaced-repetition state columns on revision_schedule.
--
-- The SM-2 algorithm (https://super-memory.com/english/ol/sm2.htm) needs
-- three pieces of state per revision card:
--   interval    — days until the next revision
--   easeFactor  — multiplier for the next interval (clamped at >= 1.3)
--   repetitions — number of consecutive successful reviews
--
-- All three default to the "first-time learner" values so any existing
-- rows stay valid and the migration is backward-compatible.

ALTER TABLE "revision_schedule"
  ADD COLUMN "interval"    INTEGER         NOT NULL DEFAULT 1,
  ADD COLUMN "easeFactor"  DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  ADD COLUMN "repetitions" INTEGER         NOT NULL DEFAULT 0;

-- Composite index for the "due today for this user" query
-- (getRevisions with opts.due = true):
--   WHERE userId = ? AND status = 'PENDING' AND scheduledFor <= now()
CREATE INDEX "revision_schedule_userId_status_scheduledFor_idx"
  ON "revision_schedule"("userId", "status", "scheduledFor");
