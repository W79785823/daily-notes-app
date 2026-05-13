-- Adds sessionVersion so password changes/reset can invalidate old sessions.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
