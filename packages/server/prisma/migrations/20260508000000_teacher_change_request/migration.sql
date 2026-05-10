-- CreateEnum
CREATE TYPE "TeacherChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "TeacherChangeRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "currentTeacherId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TeacherChangeStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherChangeRequest_studentId_idx" ON "TeacherChangeRequest"("studentId");

-- CreateIndex
CREATE INDEX "TeacherChangeRequest_currentTeacherId_idx" ON "TeacherChangeRequest"("currentTeacherId");

-- CreateIndex
CREATE INDEX "TeacherChangeRequest_status_idx" ON "TeacherChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "TeacherChangeRequest" ADD CONSTRAINT "TeacherChangeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherChangeRequest" ADD CONSTRAINT "TeacherChangeRequest_currentTeacherId_fkey" FOREIGN KEY ("currentTeacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
