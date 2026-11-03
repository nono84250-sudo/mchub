-- Mon cloud (03/11, preview « Mon cloud » v2 validée par Rushi) : un propriétaire de serveur range
-- ses modpacks (liens Modrinth + fichiers de configuration) dans son cloud et en relie un à son
-- serveur (« Obligatoire pour rejoindre » ou « Conseillé »). Les mondes en ligne restent ceux de
-- cloudWorld (Supporter et Créateur). Jamais de .jar, de mod CurseForge ni de monde dans un modpack.
-- Migration ADDITIVE uniquement : deux colonnes avec valeur par défaut, une offre en plus, une
-- nouvelle table préfixée ; rien d'existant n'est modifié ni supprimé.

-- Offres : place pour les modpacks et nombre de serveurs reliés (0 = sans limite).
-- Gratuit 500 Mo et 1 serveur ; Supporter 10 Go partagés avec les mondes et 3 serveurs.
ALTER TABLE "playOffer" ADD COLUMN "packQuotaBytes" INTEGER NOT NULL DEFAULT 500000000;
ALTER TABLE "playOffer" ADD COLUMN "packServers" INTEGER NOT NULL DEFAULT 1;
UPDATE "playOffer" SET "packQuotaBytes" = 10000000000, "packServers" = 3 WHERE "id" = 'supporter';
-- Créateur : 50 Go, versions gardées 90 jours, serveurs sans limite. Prix à définir (0 = pas encore
-- de prix, le site affiche « Prix à définir » ; le paiement n'existe pas encore).
INSERT OR IGNORE INTO "playOffer" ("id", "nameFr", "nameEn", "cloud", "quotaBytes", "keepDays", "priceCents", "sortOrder", "cloudVersions", "packQuotaBytes", "packServers")
  VALUES ('creator', 'Créateur', 'Creator', 1, 50000000000, 90, 0, 2, 10, 50000000000, 0);

-- Un modpack du cloud. files : JSON [{ projectId, title, url (cdn.modrinth.com), filename, sha1, size }]
-- (versions résolues sur Modrinth à l'enregistrement, mods demandés + dépendances obligatoires).
-- projects : JSON [{ slug, title }] (ce que le propriétaire a choisi). configKey : archive .zip des
-- fichiers de configuration dans R2 (bucket des packs, worlds/<compte>/cloudpack.<id>/), ou NULL.
-- serverId + linkMode ('required' ou 'suggested') : serveur relié (un modpack = un serveur au plus).
CREATE TABLE IF NOT EXISTS "cloudPack" (
  "id"               TEXT PRIMARY KEY,
  "userId"           TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name"             TEXT NOT NULL,
  "minecraftVersion" TEXT NOT NULL,
  "loader"           TEXT NOT NULL,
  "loaderVersion"    TEXT NOT NULL,
  "projects"         TEXT NOT NULL DEFAULT '[]',
  "files"            TEXT NOT NULL DEFAULT '[]',
  "missing"          TEXT NOT NULL DEFAULT '[]',
  "configKey"        TEXT,
  "configBytes"      INTEGER NOT NULL DEFAULT 0,
  "configCount"      INTEGER NOT NULL DEFAULT 0,
  "configSha1"       TEXT,
  "serverId"         TEXT REFERENCES "server"("id") ON DELETE SET NULL,
  "linkMode"         TEXT,
  "installCount"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS "cloudPack_user_idx" ON "cloudPack"("userId");
-- Un serveur n'a qu'un modpack relié.
CREATE UNIQUE INDEX IF NOT EXISTS "cloudPack_server_idx" ON "cloudPack"("serverId") WHERE "serverId" IS NOT NULL;
