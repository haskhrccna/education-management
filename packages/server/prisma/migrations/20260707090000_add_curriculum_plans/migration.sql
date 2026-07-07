-- Roadmap 2.2: structured curriculum plans (an ordered list of surahs with
-- target dates). Appointments and revisions can optionally link to a plan;
-- the existing ad hoc flow is entirely unaffected for anyone who never
-- creates one.

DO $$ BEGIN
    CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "curriculum_plans" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "curriculum_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "surahId" INTEGER NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_plan_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "revision_schedule" ADD COLUMN IF NOT EXISTS "planId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "curriculum_plan_items_planId_surahId_key" ON "curriculum_plan_items"("planId", "surahId");
CREATE INDEX IF NOT EXISTS "curriculum_plans_studentId_status_idx" ON "curriculum_plans"("studentId", "status");
CREATE INDEX IF NOT EXISTS "curriculum_plans_teacherId_idx" ON "curriculum_plans"("teacherId");
CREATE INDEX IF NOT EXISTS "curriculum_plan_items_planId_idx" ON "curriculum_plan_items"("planId");
CREATE INDEX IF NOT EXISTS "appointments_planId_idx" ON "appointments"("planId");
CREATE INDEX IF NOT EXISTS "revision_schedule_planId_idx" ON "revision_schedule"("planId");

DO $$ BEGIN
    ALTER TABLE "curriculum_plans" ADD CONSTRAINT "curriculum_plans_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "curriculum_plans" ADD CONSTRAINT "curriculum_plans_teacherId_fkey"
        FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "curriculum_plan_items" ADD CONSTRAINT "curriculum_plan_items_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "curriculum_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "curriculum_plan_items" ADD CONSTRAINT "curriculum_plan_items_surahId_fkey"
        FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "curriculum_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "revision_schedule" ADD CONSTRAINT "revision_schedule_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "curriculum_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
