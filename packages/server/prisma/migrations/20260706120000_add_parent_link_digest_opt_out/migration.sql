-- Add per-child weekly digest opt-out flag to parent_links (Stage 1, roadmap 1.3)

ALTER TABLE "parent_links" ADD COLUMN IF NOT EXISTS "digestOptOut" BOOLEAN NOT NULL DEFAULT false;
