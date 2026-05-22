-- CreateTable
CREATE TABLE "TatamiSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "tatamiNumber" INTEGER NOT NULL,
    "judgeName" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TatamiSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TatamiSession_token_key" ON "TatamiSession"("token");

-- CreateIndex
CREATE INDEX "TatamiSession_tournamentId_tatamiNumber_idx" ON "TatamiSession"("tournamentId", "tatamiNumber");

-- AddForeignKey
ALTER TABLE "TatamiSession" ADD CONSTRAINT "TatamiSession_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TatamiSession" ADD CONSTRAINT "TatamiSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
