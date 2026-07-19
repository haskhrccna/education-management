-- AlterTable
ALTER TABLE "recordings" ADD COLUMN     "page" INTEGER,
ADD COLUMN     "surahId" INTEGER;

-- CreateIndex
CREATE INDEX "recordings_studentId_page_idx" ON "recordings"("studentId", "page");
