-- A memo is the author's private notebook: another person deleting a
-- member (or leaving the family) must not burn it. aboutMemberId becomes
-- nullable with ON DELETE SET NULL, and aboutName snapshots the member's
-- display name at write time so orphaned notes stay readable.
-- Hand-edited to backfill aboutName so this deploys on non-empty tables.

-- DropForeignKey
ALTER TABLE "Memo" DROP CONSTRAINT "Memo_aboutMemberId_fkey";

-- AlterTable (aboutName added nullable first, backfilled, then locked)
ALTER TABLE "Memo" ADD COLUMN     "aboutName" TEXT,
ALTER COLUMN "aboutMemberId" DROP NOT NULL;

-- Backfill from the member the memo is currently about
UPDATE "Memo" m
SET "aboutName" = fm."displayName"
FROM "FamilyMember" fm
WHERE m."aboutMemberId" = fm."id";

-- Rows whose member is already gone cannot happen yet (the old FK was
-- CASCADE), but stay safe against manual data:
UPDATE "Memo" SET "aboutName" = '' WHERE "aboutName" IS NULL;

ALTER TABLE "Memo" ALTER COLUMN "aboutName" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_aboutMemberId_fkey" FOREIGN KEY ("aboutMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
