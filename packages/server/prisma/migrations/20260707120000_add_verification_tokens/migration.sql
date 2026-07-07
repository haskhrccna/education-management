-- Roadmap 3.3: stable, unguessable verification links for certificates and
-- ijazahs. Existing rows are backfilled so no record is left without a link;
-- new rows get their token from Prisma's own @default(uuid()).

ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "verificationToken" TEXT;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
UPDATE "certificates" SET "verificationToken" = gen_random_uuid()::text WHERE "verificationToken" IS NULL;
ALTER TABLE "certificates" ALTER COLUMN "verificationToken" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_verificationToken_key" ON "certificates"("verificationToken");

ALTER TABLE "ijazahs" ADD COLUMN IF NOT EXISTS "verificationToken" TEXT;
ALTER TABLE "ijazahs" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
UPDATE "ijazahs" SET "verificationToken" = gen_random_uuid()::text WHERE "verificationToken" IS NULL;
ALTER TABLE "ijazahs" ALTER COLUMN "verificationToken" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ijazahs_verificationToken_key" ON "ijazahs"("verificationToken");
