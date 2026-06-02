-- Add updatedAt to tables that already contain production/demo rows.
-- The columns are backfilled before enforcing NOT NULL so existing databases migrate cleanly.

ALTER TABLE "ApplicationEntry"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "ApplicationEntry"
SET "updatedAt" = CURRENT_TIMESTAMP
WHERE "updatedAt" IS NULL;

ALTER TABLE "ApplicationEntry"
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "ClubGroup"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "ClubGroup"
SET "updatedAt" = CURRENT_TIMESTAMP
WHERE "updatedAt" IS NULL;

ALTER TABLE "ClubGroup"
  ALTER COLUMN "updatedAt" SET NOT NULL;
