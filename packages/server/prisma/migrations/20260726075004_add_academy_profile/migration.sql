-- CreateTable
CREATE TABLE "academy_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "publicBio" TEXT,
    "programName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academy_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academy_profiles_slug_key" ON "academy_profiles"("slug");
