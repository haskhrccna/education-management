-- Add updatedAt to recordings with default value
ALTER TABLE "recordings" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add unique constraint on teacher_progress_logs
CREATE UNIQUE INDEX "teacher_progress_logs_teacherId_period_key" ON "teacher_progress_logs"("teacherId", "period");

-- Add index on recordings createdAt
CREATE INDEX "recordings_createdAt_idx" ON "recordings"("createdAt");
