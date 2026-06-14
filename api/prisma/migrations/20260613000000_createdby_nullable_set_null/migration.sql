-- Make createdById nullable with SET NULL on user deletion
-- Club, Tournament, TatamiSession: when the creator admin is deleted,
-- preserve the record but clear the creator reference.

-- Club.createdById
ALTER TABLE "Club" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "Club" DROP CONSTRAINT IF EXISTS "Club_createdById_fkey";
ALTER TABLE "Club" ADD CONSTRAINT "Club_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tournament.createdById
ALTER TABLE "Tournament" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "Tournament" DROP CONSTRAINT IF EXISTS "Tournament_createdById_fkey";
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TatamiSession.createdById
ALTER TABLE "TatamiSession" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "TatamiSession" DROP CONSTRAINT IF EXISTS "TatamiSession_createdById_fkey";
ALTER TABLE "TatamiSession" ADD CONSTRAINT "TatamiSession_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
