-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationSentAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MatchEvent_matchId_type_idx" ON "MatchEvent"("matchId", "type");

-- CreateIndex
CREATE INDEX "RatingEntry_athleteId_points_idx" ON "RatingEntry"("athleteId", "points");

-- CreateIndex
CREATE INDEX "User_emailVerificationToken_idx" ON "User"("emailVerificationToken");
