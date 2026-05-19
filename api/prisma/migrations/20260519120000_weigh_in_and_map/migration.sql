-- Store tournament map links and weigh-in schedule.
ALTER TABLE "Tournament" ADD COLUMN "mapUrl" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "weighInLocation" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "weighInStart" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN "weighInEnd" TIMESTAMP(3);
