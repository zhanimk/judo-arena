CREATE TYPE "WeighInStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED_WEIGHT', 'FAILED_DOCUMENTS', 'ABSENT', 'WITHDRAWN');

ALTER TABLE "ApplicationEntry"
  ADD COLUMN "weighInStatus" "WeighInStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "actualWeightKg" DOUBLE PRECISION,
  ADD COLUMN "weighInNotes" TEXT,
  ADD COLUMN "weighedAt" TIMESTAMP(3),
  ADD COLUMN "weighedById" TEXT;

CREATE INDEX "ApplicationEntry_weighInStatus_idx" ON "ApplicationEntry"("weighInStatus");
CREATE INDEX "ApplicationEntry_weighedById_idx" ON "ApplicationEntry"("weighedById");

ALTER TABLE "ApplicationEntry"
  ADD CONSTRAINT "ApplicationEntry_weighedById_fkey"
  FOREIGN KEY ("weighedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
