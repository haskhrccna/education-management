-- RenameTable: TeacherChangeRequest -> teacher_change_requests (@@map convention)
ALTER TABLE "TeacherChangeRequest" RENAME TO "teacher_change_requests";

-- Rename indexes to match new table name
ALTER INDEX "TeacherChangeRequest_studentId_idx" RENAME TO "teacher_change_requests_studentId_idx";
ALTER INDEX "TeacherChangeRequest_currentTeacherId_idx" RENAME TO "teacher_change_requests_currentTeacherId_idx";
ALTER INDEX "TeacherChangeRequest_status_idx" RENAME TO "teacher_change_requests_status_idx";

-- Rename constraints
ALTER TABLE "teacher_change_requests" RENAME CONSTRAINT "TeacherChangeRequest_pkey" TO "teacher_change_requests_pkey";
ALTER TABLE "teacher_change_requests" RENAME CONSTRAINT "TeacherChangeRequest_studentId_fkey" TO "teacher_change_requests_studentId_fkey";
ALTER TABLE "teacher_change_requests" RENAME CONSTRAINT "TeacherChangeRequest_currentTeacherId_fkey" TO "teacher_change_requests_currentTeacherId_fkey";
