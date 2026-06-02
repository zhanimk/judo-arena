-- Production hot-path indexes for public listings, dashboards, judging queues and ratings.
-- IF NOT EXISTS keeps this migration safe for databases that may already have hand-added indexes.

CREATE INDEX IF NOT EXISTS "User_role_isActive_idx"
  ON "User"("role", "isActive");

CREATE INDEX IF NOT EXISTS "Club_isActive_isBlocked_idx"
  ON "Club"("isActive", "isBlocked");

CREATE INDEX IF NOT EXISTS "Tournament_status_isArchived_startDate_idx"
  ON "Tournament"("status", "isArchived", "startDate");

CREATE INDEX IF NOT EXISTS "Tournament_city_status_idx"
  ON "Tournament"("city", "status");

CREATE INDEX IF NOT EXISTS "Category_tournamentId_gender_ageMin_ageMax_idx"
  ON "Category"("tournamentId", "gender", "ageMin", "ageMax");

CREATE INDEX IF NOT EXISTS "Application_tournamentId_status_idx"
  ON "Application"("tournamentId", "status");

CREATE INDEX IF NOT EXISTS "Application_clubId_status_idx"
  ON "Application"("clubId", "status");

CREATE INDEX IF NOT EXISTS "ApplicationEntry_athleteId_idx"
  ON "ApplicationEntry"("athleteId");

CREATE INDEX IF NOT EXISTS "ApplicationEntry_categoryId_weighInStatus_idx"
  ON "ApplicationEntry"("categoryId", "weighInStatus");

CREATE INDEX IF NOT EXISTS "Bracket_tournamentId_idx"
  ON "Bracket"("tournamentId");

CREATE INDEX IF NOT EXISTS "Bracket_categoryId_idx"
  ON "Bracket"("categoryId");

CREATE INDEX IF NOT EXISTS "Match_tournamentId_status_idx"
  ON "Match"("tournamentId", "status");

CREATE INDEX IF NOT EXISTS "Match_tournamentId_tatamiNumber_queuePosition_idx"
  ON "Match"("tournamentId", "tatamiNumber", "queuePosition");

CREATE INDEX IF NOT EXISTS "Match_redAthleteId_idx"
  ON "Match"("redAthleteId");

CREATE INDEX IF NOT EXISTS "Match_blueAthleteId_idx"
  ON "Match"("blueAthleteId");

CREATE INDEX IF NOT EXISTS "Match_winnerId_idx"
  ON "Match"("winnerId");

CREATE INDEX IF NOT EXISTS "JudgeSession_expiresAt_isRevoked_idx"
  ON "JudgeSession"("expiresAt", "isRevoked");

CREATE INDEX IF NOT EXISTS "TatamiSession_expiresAt_isRevoked_idx"
  ON "TatamiSession"("expiresAt", "isRevoked");

CREATE INDEX IF NOT EXISTS "RatingEntry_tournamentId_idx"
  ON "RatingEntry"("tournamentId");

CREATE INDEX IF NOT EXISTS "RatingEntry_categoryId_idx"
  ON "RatingEntry"("categoryId");

CREATE INDEX IF NOT EXISTS "RatingEntry_points_idx"
  ON "RatingEntry"("points");
