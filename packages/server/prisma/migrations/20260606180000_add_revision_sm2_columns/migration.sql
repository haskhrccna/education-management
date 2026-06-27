DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'revision_schedule'
  ) THEN
    CREATE TABLE "revision_schedule" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "surahId" INTEGER NOT NULL,
      "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "status" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "interval"    INTEGER         NOT NULL DEFAULT 1,
      "easeFactor"  DOUBLE PRECISION NOT NULL DEFAULT 2.5,
      "repetitions" INTEGER         NOT NULL DEFAULT 0,
      CONSTRAINT "revision_schedule_pkey" PRIMARY KEY ("id")
    );
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'revision_schedule' AND column_name = 'interval') THEN
      ALTER TABLE "revision_schedule" ADD COLUMN "interval" INTEGER NOT NULL DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'revision_schedule' AND column_name = 'easeFactor') THEN
      ALTER TABLE "revision_schedule" ADD COLUMN "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'revision_schedule' AND column_name = 'repetitions') THEN
      ALTER TABLE "revision_schedule" ADD COLUMN "repetitions" INTEGER NOT NULL DEFAULT 0;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "revision_schedule_userId_status_scheduledFor_idx"
  ON "revision_schedule"("userId", "status", "scheduledFor");
