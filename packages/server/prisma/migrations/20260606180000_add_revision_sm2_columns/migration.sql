ALTER TABLE "revision_schedule"
  ADD COLUMN "interval"    INTEGER         NOT NULL DEFAULT 1,
  ADD COLUMN "easeFactor"  DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  ADD COLUMN "repetitions" INTEGER         NOT NULL DEFAULT 0;

-- Composite index for the "due today for this user" query
-- (getRevisions with opts.due = true):
--   WHERE userId = ? AND status = 'PENDING' AND scheduledFor <= now()
CREATE INDEX "revision_schedule_userId_status_scheduledFor_idx"
  ON "revision_schedule"("userId", "status", "scheduledFor");
