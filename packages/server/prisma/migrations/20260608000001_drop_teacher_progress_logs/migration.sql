-- Drop the dead teacher_progress_logs table.
--
-- Created in the original init migration and modified once more before the
-- model was removed from schema.prisma. Its columns (studentsTeaching,
-- sessionsCompleted, averageGrade, period) describe a generic school/teacher
-- progress-log concept that has no place in a Quran-only app. Prisma
-- migrate dev keeps recreating drift against this orphan, so removing the
-- table here makes the migration history self-consistent again.

DROP TABLE IF EXISTS "teacher_progress_logs";
