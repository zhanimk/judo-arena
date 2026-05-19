-- Add an optional registration deadline for coach applications.
ALTER TABLE "Tournament" ADD COLUMN "applicationDeadline" TIMESTAMP(3);
