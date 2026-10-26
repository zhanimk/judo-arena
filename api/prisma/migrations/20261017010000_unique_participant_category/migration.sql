-- One athlete per category, including concurrent club and individual submissions.
-- Deliberately fail on legacy duplicates so an operator can resolve them without losing entry history.
CREATE UNIQUE INDEX "ApplicationEntry_athleteId_categoryId_key" ON "ApplicationEntry"("athleteId", "categoryId");
