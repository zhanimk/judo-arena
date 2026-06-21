-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "address" TEXT,
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "coachCategory" TEXT,
ADD COLUMN     "coachExperienceYears" INTEGER,
ADD COLUMN     "coachTitle" TEXT,
ADD COLUMN     "education" TEXT;
