-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "coverMediaId" TEXT;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
