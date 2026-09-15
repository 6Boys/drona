-- CreateEnum
CREATE TYPE "SwipeTargetKind" AS ENUM ('PHOTO', 'PROMPT');

-- AlterTable: what a LIKE/TWINKLE was actually about (Hinge's "like a
-- specific photo or answer, with an optional comment"), never set on PASS.
ALTER TABLE "swipes"
  ADD COLUMN "targetKind" "SwipeTargetKind",
  ADD COLUMN "targetPromptIndex" INTEGER,
  ADD COLUMN "note" TEXT;

-- CreateTable
CREATE TABLE "dating_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vibe" TEXT NOT NULL DEFAULT '',
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prompts" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dating_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dating_profiles_userId_key" ON "dating_profiles"("userId");

-- AddForeignKey
ALTER TABLE "dating_profiles" ADD CONSTRAINT "dating_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
