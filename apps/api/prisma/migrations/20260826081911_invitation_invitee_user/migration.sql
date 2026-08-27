-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "inviteeUserId" TEXT;

-- CreateIndex
CREATE INDEX "Invitation_inviteeUserId_status_idx" ON "Invitation"("inviteeUserId", "status");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
