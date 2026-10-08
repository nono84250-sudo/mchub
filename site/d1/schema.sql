-- Schema D1 (SQLite) : conversion de src/prisma/contract.prisma.
-- Conventions :
--   - Dates : TEXT au format ISO 8601 UTC (ex. 2026-10-06T12:00:00.000Z), comme TimestamptzString.
--   - Booleens : INTEGER 0/1.
--   - Enums : TEXT + CHECK. Valeurs identiques a Postgres.
--   - UUID : generes par l'application (D1 n'a pas de gen_random_uuid()).
--   - Pas de relations declarees en FK strictes sauf ON DELETE CASCADE (PRAGMA foreign_keys = ON requis par D1 session).


CREATE TABLE "user" (
  "id"                 TEXT PRIMARY KEY,
  "name"               TEXT NOT NULL,
  "minecraftUuid"      TEXT UNIQUE,
  "minecraftUsername"  TEXT,
  "sessionsValidAfter" TEXT,
  "createdAt"          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "server" (
  "id"                       TEXT PRIMARY KEY,
  "slug"                     TEXT NOT NULL UNIQUE,
  "name"                     TEXT NOT NULL,
  "description"              TEXT NOT NULL,
  "bannerUrl"                TEXT,
  "iconUrl"                  TEXT,
  "backgroundUrl"            TEXT,
  "type"                     TEXT NOT NULL DEFAULT 'vanilla' CHECK ("type" IN ('vanilla', 'modded')),
  "minecraftVersion"         TEXT NOT NULL,
  "ip"                       TEXT NOT NULL,
  "curseforgeModpackId"      TEXT,
  "curseforgeModpackName"    TEXT,
  "curseforgeModpackVersion" TEXT,
  "modpackSource"            TEXT NOT NULL DEFAULT 'curseforge' CHECK ("modpackSource" IN ('curseforge', 'modrinth')),
  "playerCount"              INTEGER,
  "playerCapacity"           INTEGER,
  "lastPingedAt"             TEXT,
  "recommendedRamGB"         INTEGER,
  "published"                INTEGER NOT NULL DEFAULT 1,
  "frozenAt"                 TEXT,
  "frozenReason"             TEXT,
  "frozenBy"                 TEXT,
  "viewCount"                INTEGER NOT NULL DEFAULT 0,
  "launchCount"              INTEGER NOT NULL DEFAULT 0,
  "isPrivate"                INTEGER NOT NULL DEFAULT 0,
  "inviteCode"               TEXT UNIQUE,
  "discordUrl"               TEXT,
  "websiteUrl"               TEXT,
  "ownerId"                  TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt"                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "server_ownerId_idx" ON "server"("ownerId");

CREATE TABLE "serverEvent" (
  "id"        TEXT PRIMARY KEY,
  "serverId"  TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "kind"      TEXT NOT NULL CHECK ("kind" IN ('view', 'launch')),
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "serverEvent_serverId_kind_createdAt_idx" ON "serverEvent"("serverId", "kind", "createdAt");

CREATE TABLE "report" (
  "id"                        TEXT PRIMARY KEY,
  "serverId"                  TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "reporterMinecraftUuid"     TEXT NOT NULL,
  "reporterMinecraftUsername" TEXT NOT NULL,
  "issue"                     TEXT NOT NULL CHECK ("issue" IN ('cant_connect', 'wrong_version', 'modpack_download', 'crash', 'other')),
  "message"                   TEXT NOT NULL,
  "clientVersion"             TEXT,
  "launcherVersion"           TEXT,
  "status"                    TEXT NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'replied', 'resolved')),
  "reply"                     TEXT,
  "createdAt"                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "report_serverId_status_createdAt_idx" ON "report"("serverId", "status", "createdAt");

CREATE TABLE "notification" (
  "id"                     TEXT PRIMARY KEY,
  "recipientMinecraftUuid" TEXT NOT NULL,
  "type"                   TEXT NOT NULL CHECK ("type" IN ('report_replied', 'report_resolved', 'server_frozen', 'admin_info', 'admin_warning', 'admin_error', 'broadcast_announcement', 'broadcast_maintenance', 'broadcast_alert', 'broadcast_promotion')),
  "serverName"             TEXT NOT NULL,
  "message"                TEXT,
  "read"                   INTEGER NOT NULL DEFAULT 0,
  "createdAt"              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "notification_recipient_read_createdAt_idx" ON "notification"("recipientMinecraftUuid", "read", "createdAt");

CREATE TABLE "platformSetting" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "adminAccount" (
  "id"                    TEXT PRIMARY KEY,
  "username"              TEXT NOT NULL UNIQUE,
  "passwordHash"          TEXT NOT NULL,
  "role"                  TEXT NOT NULL,
  "mustChangeCredentials" INTEGER NOT NULL DEFAULT 1,
  "createdAt"             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
