-- Migration 2026-10-16 : demandes d'etiquettes (voir lib/tagRequests.ts et lib/tagCatalog.ts,
-- et les tables "tagRequest", "customTag", "tagAlias" dans ../schema.sql). Un proprietaire
-- propose un mot qui manque ; l'equipe l'accepte (customTag + alias du mot), le relie a une
-- etiquette existante (alias seul) ou le refuse. Les etiquettes en dur (PAGE_TAGS) restent la base.
--
-- Sans risque a relancer (IF NOT EXISTS). Une base creee depuis schema.sql a jour n'en a pas besoin.
-- Appliquee sur la base DEV (omniscient-launcher-dev) le 16/10.
--
-- NE PAS lancer sur la base de production sans l'accord explicite de l'utilisateur.
CREATE TABLE IF NOT EXISTS "tagRequest" (
  "id"           TEXT PRIMARY KEY,
  "serverId"     TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "ownerUserId"  TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "word"         TEXT NOT NULL,
  "normalized"   TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "resultTagId"  TEXT,
  "refuseReason" INTEGER,
  "createdAt"    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "decidedAt"    TEXT
);
CREATE INDEX IF NOT EXISTS "tagRequest_status_idx" ON "tagRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "tagRequest_normalized_idx" ON "tagRequest"("normalized");
CREATE INDEX IF NOT EXISTS "tagRequest_server_idx" ON "tagRequest"("serverId");
CREATE INDEX IF NOT EXISTS "tagRequest_owner_idx" ON "tagRequest"("ownerUserId", "createdAt");

CREATE TABLE IF NOT EXISTS "customTag" (
  "id"        TEXT PRIMARY KEY,
  "nameFr"    TEXT NOT NULL,
  "nameEn"    TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS "tagAlias" (
  "normalized" TEXT PRIMARY KEY,
  "tagId"      TEXT NOT NULL,
  "createdAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
