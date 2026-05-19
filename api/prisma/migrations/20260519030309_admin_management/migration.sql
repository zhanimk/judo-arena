-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;
