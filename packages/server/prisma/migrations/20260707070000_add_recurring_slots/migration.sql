-- Roadmap 2.3: standing weekly appointment slots. Generated occurrences are
-- ordinary appointments rows tagged with recurringSlotId — no parallel
-- booking model.

CREATE TABLE IF NOT EXISTS "recurring_slots" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_slots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "recurringSlotId" TEXT;

CREATE INDEX IF NOT EXISTS "recurring_slots_teacherId_active_idx" ON "recurring_slots"("teacherId", "active");
CREATE INDEX IF NOT EXISTS "recurring_slots_studentId_active_idx" ON "recurring_slots"("studentId", "active");
CREATE INDEX IF NOT EXISTS "appointments_recurringSlotId_idx" ON "appointments"("recurringSlotId");

DO $$ BEGIN
    ALTER TABLE "recurring_slots" ADD CONSTRAINT "recurring_slots_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "recurring_slots" ADD CONSTRAINT "recurring_slots_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_recurringSlotId_fkey"
        FOREIGN KEY ("recurringSlotId") REFERENCES "recurring_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
