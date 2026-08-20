-- CreateTable
CREATE TABLE "AiSuggestionCache" (
    "cacheKey" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestionCache_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateIndex
CREATE INDEX "AiSuggestionCache_memberId_kind_idx" ON "AiSuggestionCache"("memberId", "kind");
