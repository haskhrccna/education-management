-- Roadmap 4.1: guardian consent for recitation voice-data collection,
-- separate from ParentLinkStatus (which verifies who the parent is).

DO $$ BEGIN
    CREATE TYPE "GuardianConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guardianConsentStatus" "GuardianConsentStatus";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guardianConsentAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guardianConsentDecidedBy" TEXT;

DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_guardianConsentDecidedBy_fkey"
        FOREIGN KEY ("guardianConsentDecidedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
