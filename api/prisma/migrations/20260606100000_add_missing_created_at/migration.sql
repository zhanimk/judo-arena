-- ApplicationEntry was created in init without createdAt.
-- Added to schema later but migration was never generated.
ALTER TABLE "ApplicationEntry"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
