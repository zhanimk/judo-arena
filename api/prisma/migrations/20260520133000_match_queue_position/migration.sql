-- Store explicit per-tatami queue order for tournament day operations.
ALTER TABLE "Match" ADD COLUMN "queuePosition" INTEGER;

CREATE INDEX "Match_tatamiNumber_queuePosition_idx" ON "Match"("tatamiNumber", "queuePosition");
