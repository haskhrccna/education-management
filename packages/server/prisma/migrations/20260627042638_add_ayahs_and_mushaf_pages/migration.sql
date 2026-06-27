-- Add pages array to Surah and create Ayah table

ALTER TABLE "surahs" ADD COLUMN IF NOT EXISTS "pages" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

CREATE TABLE IF NOT EXISTS "ayahs" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "surahId" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "juz" INTEGER NOT NULL,
    "audioUrl" TEXT,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ayahs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ayahs_surahId_number_key" ON "ayahs"("surahId", "number");
CREATE INDEX IF NOT EXISTS "ayahs_surahId_idx" ON "ayahs"("surahId");
CREATE INDEX IF NOT EXISTS "ayahs_page_idx" ON "ayahs"("page");

-- Add foreign key if both tables exist and FK not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = current_schema()
      AND constraint_name = 'ayahs_surahId_fkey'
      AND table_name = 'ayahs'
  ) THEN
    ALTER TABLE "ayahs" ADD CONSTRAINT "ayahs_surahId_fkey"
      FOREIGN KEY ("surahId") REFERENCES "surahs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
