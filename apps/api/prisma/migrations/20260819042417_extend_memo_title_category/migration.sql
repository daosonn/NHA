/*
  Warnings:

  - Added the required column `title` to the `Memo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Memo" ADD COLUMN     "category" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "content" DROP NOT NULL;
