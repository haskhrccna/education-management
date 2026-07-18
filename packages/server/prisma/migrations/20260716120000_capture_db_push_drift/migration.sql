-- Captures all remaining db-push drift (columns/indexes/FKs that existed only
-- on pushed databases). Generated verbatim by `prisma migrate diff --script` on 2026-07-16 (F4a).


-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('PENDING', 'COMPLETED', 'MISSED');

-- DropForeignKey
ALTER TABLE "teacher_change_requests" DROP CONSTRAINT "teacher_change_requests_currentTeacherId_fkey";

-- DropIndex
DROP INDEX "appointments_teacherId_requestedDate_idx";

-- DropIndex
DROP INDEX "streaks_currentStreak_idx";

-- DropIndex
DROP INDEX "user_badges_userId_earnedAt_idx";

-- AlterTable
ALTER TABLE "recordings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "revision_schedule" ADD COLUMN     "notedAt" TIMESTAMP(3),
ALTER COLUMN "scheduledFor" DROP DEFAULT,
DROP COLUMN "status",
ADD COLUMN     "status" "RevisionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "teacher_change_requests" ALTER COLUMN "currentTeacherId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assignedTeacherId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deviceToken" TEXT,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "appointments_teacherId_requestedDate_status_idx" ON "appointments"("teacherId", "requestedDate", "status");

-- CreateIndex
CREATE INDEX "messages_receiverId_readAt_createdAt_idx" ON "messages"("receiverId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "recordings_studentId_createdAt_idx" ON "recordings"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "revision_schedule_userId_status_idx" ON "revision_schedule"("userId", "status");

-- CreateIndex
CREATE INDEX "revision_schedule_userId_scheduledFor_idx" ON "revision_schedule"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "revision_schedule_surahId_idx" ON "revision_schedule"("surahId");

-- CreateIndex
CREATE INDEX "revision_schedule_scheduledFor_status_idx" ON "revision_schedule"("scheduledFor", "status");

-- CreateIndex
CREATE INDEX "revision_schedule_userId_status_scheduledFor_idx" ON "revision_schedule"("userId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "streaks_currentStreak_idx" ON "streaks"("currentStreak");

-- CreateIndex
CREATE INDEX "surahs_juz_idx" ON "surahs"("juz");

-- CreateIndex
CREATE INDEX "surahs_number_idx" ON "surahs"("number");

-- CreateIndex
CREATE INDEX "user_badges_userId_earnedAt_idx" ON "user_badges"("userId", "earnedAt");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assignedTeacherId_fkey" FOREIGN KEY ("assignedTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_schedule" ADD CONSTRAINT "revision_schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_schedule" ADD CONSTRAINT "revision_schedule_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_change_requests" ADD CONSTRAINT "teacher_change_requests_currentTeacherId_fkey" FOREIGN KEY ("currentTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
