-- CreateTable
CREATE TABLE "MediaInsight" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "insight" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaInsight_mediaId_key" ON "MediaInsight"("mediaId");

-- AddForeignKey
ALTER TABLE "MediaInsight" ADD CONSTRAINT "MediaInsight_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
