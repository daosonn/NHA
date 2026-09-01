-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SpecialDateType" ADD VALUE 'TET';
ALTER TYPE "SpecialDateType" ADD VALUE 'MILESTONE';

-- AlterTable
ALTER TABLE "SpecialDate" ADD COLUMN     "isLunar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "remindDaysBefore" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "repeatsYearly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "year" INTEGER,
ALTER COLUMN "familyId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "SpecialDate_familyId_idx" ON "SpecialDate"("familyId");

-- CreateIndex
CREATE INDEX "SpecialDate_ownerUserId_idx" ON "SpecialDate"("ownerUserId");

-- AddForeignKey
ALTER TABLE "SpecialDate" ADD CONSTRAINT "SpecialDate_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- HAND-WRITTEN (Prisma cannot express CHECK constraints — same pattern as
-- LifeProfile's userId/memberId XOR in 20260814063321_full_mvp_schema).
-- SpecialDate: exactly one of familyId / ownerUserId (family-scoped XOR personal)
ALTER TABLE "SpecialDate" ADD CONSTRAINT "SpecialDate_scope_xor_check"
  CHECK (("familyId" IS NULL) <> ("ownerUserId" IS NULL));