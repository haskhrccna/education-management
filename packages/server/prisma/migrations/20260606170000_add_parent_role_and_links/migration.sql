-- Phase 3 — Parent / Guardian role + link approval workflow
-- Adds the PARENT enum value to "Role", a new "ParentLinkStatus" enum,
-- and a parent_links table that links a parent to a student (with
-- admin approval gating read access to the child dashboard).

-- 1. Extend Role enum with PARENT
ALTER TYPE "Role" ADD VALUE 'PARENT';

-- 2. New enum for link state
CREATE TYPE "ParentLinkStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- 3. New parent_links table
CREATE TABLE "parent_links" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "ParentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,

    CONSTRAINT "parent_links_pkey" PRIMARY KEY ("id")
);

-- A parent can only link to a given student once
CREATE UNIQUE INDEX "parent_links_parentId_studentId_key"
    ON "parent_links"("parentId", "studentId");

CREATE INDEX "parent_links_parentId_status_idx"
    ON "parent_links"("parentId", "status");

CREATE INDEX "parent_links_studentId_status_idx"
    ON "parent_links"("studentId", "status");

CREATE INDEX "parent_links_status_idx"
    ON "parent_links"("status");

ALTER TABLE "parent_links"
    ADD CONSTRAINT "parent_links_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parent_links"
    ADD CONSTRAINT "parent_links_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parent_links"
    ADD CONSTRAINT "parent_links_decidedBy_fkey"
    FOREIGN KEY ("decidedBy") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
