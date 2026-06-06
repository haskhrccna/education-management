-- Phase 2 — Attendance + Session Completion
-- One SessionRecord per Appointment (1:1 via unique on appointmentId).
-- A teacher closing out a session writes this row AND flips the
-- parent Appointment.status to COMPLETED in a single transaction.

CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

CREATE TABLE "session_records" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_records_pkey" PRIMARY KEY ("id")
);

-- 1:1 with Appointment — a second record on the same appointment is a bug
CREATE UNIQUE INDEX "session_records_appointmentId_key"
    ON "session_records"("appointmentId");

CREATE INDEX "session_records_studentId_recordedAt_idx"
    ON "session_records"("studentId", "recordedAt");

CREATE INDEX "session_records_teacherId_recordedAt_idx"
    ON "session_records"("teacherId", "recordedAt");

CREATE INDEX "session_records_status_idx"
    ON "session_records"("status");

ALTER TABLE "session_records"
    ADD CONSTRAINT "session_records_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_records"
    ADD CONSTRAINT "session_records_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_records"
    ADD CONSTRAINT "session_records_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
