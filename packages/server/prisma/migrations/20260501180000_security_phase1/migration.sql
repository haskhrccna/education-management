-- Add APPROVED to UserStatus enum (already exists in DB, just syncing Prisma)
-- No-op: DB already has APPROVED from init migration

-- Add refreshTokenHash column and index for secure token storage
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;
CREATE INDEX IF NOT EXISTS "users_refreshTokenHash_idx" ON "users"("refreshTokenHash");

-- Drop plaintext refreshToken column if it still exists (security: tokens were stored unhashed)
ALTER TABLE "users" DROP COLUMN IF EXISTS "refreshToken";
