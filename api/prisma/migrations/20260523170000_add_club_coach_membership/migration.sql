-- Add explicit staff roles for coaches inside a club and coach-to-club join requests.
CREATE TYPE "ClubRole" AS ENUM ('OWNER', 'COACH');

ALTER TABLE "User" ADD COLUMN "clubRole" "ClubRole";

UPDATE "User"
SET "clubRole" = 'COACH'
WHERE "role" = 'COACH' AND "clubId" IS NOT NULL;

UPDATE "User" AS u
SET "clubRole" = 'OWNER'
FROM "Club" AS c
WHERE c."createdById" = u."id"
  AND u."role" = 'COACH'
  AND u."clubId" = c."id";

CREATE TABLE "CoachClubJoinRequest" (
  "id" TEXT NOT NULL,
  "coachId" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoachClubJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoachClubJoinRequest_coachId_clubId_key" ON "CoachClubJoinRequest"("coachId", "clubId");
CREATE INDEX "CoachClubJoinRequest_clubId_status_idx" ON "CoachClubJoinRequest"("clubId", "status");
CREATE INDEX "CoachClubJoinRequest_coachId_status_idx" ON "CoachClubJoinRequest"("coachId", "status");

ALTER TABLE "CoachClubJoinRequest"
  ADD CONSTRAINT "CoachClubJoinRequest_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoachClubJoinRequest"
  ADD CONSTRAINT "CoachClubJoinRequest_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
