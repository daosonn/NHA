-- AlterTable
ALTER TABLE "VideoJob" ADD COLUMN     "aboutMemberId" TEXT,
ADD COLUMN     "durationS" DOUBLE PRECISION,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'ai',
ADD COLUMN     "options" JSONB,
ADD COLUMN     "plan" JSONB,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stage" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE INDEX "VideoJob_requesterUserId_createdAt_idx" ON "VideoJob"("requesterUserId", "createdAt");
