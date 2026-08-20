-- CreateTable
CREATE TABLE "ProductCache" (
    "cacheKey" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "products" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCache_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateTable
CREATE TABLE "InterestSignal" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "signalType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "basis" JSONB,
    "observedAt" DATE NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberProfile" (
    "memberId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "profile" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("memberId","version")
);

-- CreateTable
CREATE TABLE "MemberCounter" (
    "memberId" TEXT NOT NULL,
    "postsSinceRollup" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCounter_pkey" PRIMARY KEY ("memberId")
);

-- CreateIndex
CREATE INDEX "InterestSignal_memberId_processed_revoked_idx" ON "InterestSignal"("memberId", "processed", "revoked");

-- AddForeignKey
ALTER TABLE "InterestSignal" ADD CONSTRAINT "InterestSignal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCounter" ADD CONSTRAINT "MemberCounter_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
