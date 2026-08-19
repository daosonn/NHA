-- Review 2026-08-19: the job's result was re-derived from
-- resultStorageKey via an unindexed, non-unique Media lookup that could
-- resolve to another user's row. Store the FK instead (unique — one job
-- per result), and index requesterUserId for the "my jobs" list.
-- Hand-authored: `migrate dev` cannot confirm the unique-constraint
-- warning in a non-interactive terminal; the column is new and all-NULL,
-- so the constraint cannot conflict.

-- AlterTable
ALTER TABLE "VideoJob" ADD COLUMN "resultMediaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VideoJob_resultMediaId_key" ON "VideoJob"("resultMediaId");

-- CreateIndex
CREATE INDEX "VideoJob_requesterUserId_idx" ON "VideoJob"("requesterUserId");

-- AddForeignKey
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_resultMediaId_fkey" FOREIGN KEY ("resultMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
