-- CreateEnum
CREATE TYPE "PageMemorizationStatus" AS ENUM ('NOT_STARTED', 'LEARNING', 'MEMORIZED', 'SOLID');

-- CreateTable
CREATE TABLE "page_memorizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "status" "PageMemorizationStatus" NOT NULL DEFAULT 'LEARNING',
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_memorizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_memorizations_userId_idx" ON "page_memorizations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "page_memorizations_userId_page_key" ON "page_memorizations"("userId", "page");

-- AddForeignKey
ALTER TABLE "page_memorizations" ADD CONSTRAINT "page_memorizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
