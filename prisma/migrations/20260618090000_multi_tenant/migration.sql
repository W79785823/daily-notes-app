BEGIN;

CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ownerId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Invite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt" TIMESTAMP(3),
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invite_code_key" ON "Invite"("code");
CREATE INDEX IF NOT EXISTS "Invite_teamId_idx" ON "Invite"("teamId");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "teamId" TEXT;

DO $$
DECLARE
  default_team_id TEXT := 'default-team';
  owner_user_id TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Team") THEN
    INSERT INTO "Team" ("id", "name", "active", "createdAt", "updatedAt")
    VALUES (default_team_id, '默认团队', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    UPDATE "User"
    SET "teamId" = default_team_id
    WHERE "isSuperAdmin" = false AND "teamId" IS NULL;

    UPDATE "Task"
    SET "teamId" = default_team_id
    WHERE "teamId" IS NULL;

    UPDATE "Announcement"
    SET "teamId" = default_team_id
    WHERE "teamId" IS NULL;

    UPDATE "AuditLog"
    SET "teamId" = default_team_id
    WHERE "teamId" IS NULL;

    SELECT "id" INTO owner_user_id
    FROM "User"
    WHERE "teamId" = default_team_id AND "role" = 'ADMIN'
    ORDER BY "createdAt" ASC
    LIMIT 1;

    IF owner_user_id IS NOT NULL THEN
      UPDATE "Team"
      SET "ownerId" = owner_user_id
      WHERE "id" = default_team_id;
    END IF;
  END IF;
END $$;

ALTER TABLE "Task" ALTER COLUMN "teamId" SET NOT NULL;
ALTER TABLE "Announcement" ALTER COLUMN "teamId" SET NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_name_key";
DROP INDEX IF EXISTS "User_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_teamId_name_key" ON "User"("teamId", "name");
CREATE INDEX IF NOT EXISTS "User_teamId_idx" ON "User"("teamId");
CREATE INDEX IF NOT EXISTS "Task_teamId_idx" ON "Task"("teamId");
CREATE INDEX IF NOT EXISTS "Announcement_teamId_idx" ON "Announcement"("teamId");
CREATE INDEX IF NOT EXISTS "AuditLog_teamId_idx" ON "AuditLog"("teamId");

DO $$
BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Invite" ADD CONSTRAINT "Invite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
