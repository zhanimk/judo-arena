-- Add user profile documents for athletes and coaches.
CREATE TYPE "UserDocumentType" AS ENUM (
  'BIRTH_CERTIFICATE',
  'STUDY_CERTIFICATE',
  'COACH_ID'
);

CREATE TABLE "UserDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UserDocumentType" NOT NULL,
  "url" TEXT NOT NULL,
  "originalName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDocument_userId_type_key" ON "UserDocument"("userId", "type");
CREATE INDEX "UserDocument_userId_idx" ON "UserDocument"("userId");
CREATE INDEX "UserDocument_type_idx" ON "UserDocument"("type");

ALTER TABLE "UserDocument"
  ADD CONSTRAINT "UserDocument_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
