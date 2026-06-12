-- AddColumn: точное время входа в golden score для корректного восстановления таймера после рестарта сервера
ALTER TABLE "Match" ADD COLUMN "goldenScoreStartedAt" TIMESTAMP(3);
