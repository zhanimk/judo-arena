-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ATHLETE', 'COACH', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ru', 'kk', 'en');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BracketFormat" AS ENUM ('SE_IJF', 'ROUND_ROBIN', 'MIXED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('HAJIME', 'MATE', 'SORE_MADE', 'IPPON', 'WAZA_ARI', 'YUKO', 'SHIDO', 'HANSOKU_MAKE', 'GOLDEN_SCORE', 'REPLAY', 'END');

-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('RED', 'BLUE', 'WHITE', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "nameLatin" TEXT,
    "surnameLatin" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "weightKg" DOUBLE PRECISION,
    "beltRank" TEXT,
    "preferredLocale" "Locale" NOT NULL DEFAULT 'kk',
    "avatarUrl" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "shortName" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'KZ',
    "logoUrl" TEXT,
    "description" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubGroup" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "location" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "tatamiCount" INTEGER NOT NULL DEFAULT 1,
    "primaryLocale" "Locale" NOT NULL DEFAULT 'kk',
    "posterUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" JSONB,
    "gender" "Gender" NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "weightMin" DOUBLE PRECISION NOT NULL,
    "weightMax" DOUBLE PRECISION NOT NULL,
    "matchDurationSec" INTEGER NOT NULL DEFAULT 240,
    "goldenScoreSec" INTEGER NOT NULL DEFAULT 0,
    "format" "BracketFormat" NOT NULL DEFAULT 'SE_IJF',
    "allowYuko" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEntry" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ApplicationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bracket" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "format" "BracketFormat" NOT NULL,
    "size" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "bracketSection" TEXT,
    "redAthleteId" TEXT,
    "blueAthleteId" TEXT,
    "tatamiNumber" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "winnerId" TEXT,
    "scoreSnapshot" JSONB,
    "isGoldenScore" BOOLEAN NOT NULL DEFAULT false,
    "isReplay" BOOLEAN NOT NULL DEFAULT false,
    "replayReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" "MatchEventType" NOT NULL,
    "side" "MatchSide",
    "actorJudgeSessionId" TEXT,
    "scoreSnapshot" JSONB,
    "meta" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeSession" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "judgeName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingEntry" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "bodyKey" TEXT NOT NULL,
    "payload" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "locale" "Locale" NOT NULL DEFAULT 'kk',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clubId_idx" ON "User"("clubId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Club_city_idx" ON "Club"("city");

-- CreateIndex
CREATE INDEX "ClubGroup_clubId_idx" ON "ClubGroup"("clubId");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_startDate_idx" ON "Tournament"("startDate");

-- CreateIndex
CREATE INDEX "Category_tournamentId_idx" ON "Category"("tournamentId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_tournamentId_clubId_key" ON "Application"("tournamentId", "clubId");

-- CreateIndex
CREATE INDEX "ApplicationEntry_categoryId_idx" ON "ApplicationEntry"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEntry_applicationId_athleteId_categoryId_key" ON "ApplicationEntry"("applicationId", "athleteId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Bracket_tournamentId_categoryId_key" ON "Bracket"("tournamentId", "categoryId");

-- CreateIndex
CREATE INDEX "Match_bracketId_round_position_idx" ON "Match"("bracketId", "round", "position");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_tatamiNumber_idx" ON "Match"("tatamiNumber");

-- CreateIndex
CREATE INDEX "MatchEvent_matchId_occurredAt_idx" ON "MatchEvent"("matchId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeSession_token_key" ON "JudgeSession"("token");

-- CreateIndex
CREATE INDEX "JudgeSession_matchId_idx" ON "JudgeSession"("matchId");

-- CreateIndex
CREATE INDEX "RatingEntry_athleteId_idx" ON "RatingEntry"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "RatingEntry_athleteId_tournamentId_categoryId_key" ON "RatingEntry"("athleteId", "tournamentId", "categoryId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_targetEntity_targetId_idx" ON "AuditLog"("targetEntity", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubGroup" ADD CONSTRAINT "ClubGroup_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEntry" ADD CONSTRAINT "ApplicationEntry_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEntry" ADD CONSTRAINT "ApplicationEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEntry" ADD CONSTRAINT "ApplicationEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_redAthleteId_fkey" FOREIGN KEY ("redAthleteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_blueAthleteId_fkey" FOREIGN KEY ("blueAthleteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeSession" ADD CONSTRAINT "JudgeSession_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
