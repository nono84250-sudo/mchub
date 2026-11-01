-- Pack Omniscient (27/10, preview v22 validée par Rushi) : un pack fait dans le launcher (fichier
-- .omnipack) peut être proposé par un joueur sur le site, puis importé et publié par l'admin.
-- Migration ADDITIVE uniquement (nouvelles colonnes avec valeur par défaut + nouvelle table) :
-- rien d'existant n'est modifié ni supprimé.

-- kind : 'list' (pack officiel = liste de mods Modrinth, comme avant) ou 'omni' (pack Omniscient,
-- son archive .omnipack est rangée dans R2). author : nom affiché « Proposé par ».
-- archive : JSON { "prefix", "parts", "size", "sha256" } (packs 'omni' seulement).
ALTER TABLE "playPack" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'list';
ALTER TABLE "playPack" ADD COLUMN "author" TEXT;
ALTER TABLE "playPack" ADD COLUMN "archive" TEXT;
ALTER TABLE "playPack" ADD COLUMN "submissionId" TEXT;

-- Ce que contient la version en plus des mods : JSON { "resourcepacks", "shaders", "datapacks",
-- "worlds", "own" (fichiers hors Modrinth, à vérifier), "tested" (testée par l'auteur) }.
ALTER TABLE "playPackVersion" ADD COLUMN "extras" TEXT NOT NULL DEFAULT '{}';

-- Packs proposés par les joueurs (page « Proposer un pack »). status : uploading (envoi en cours),
-- pending (en attente de l'admin), imported (importé dans les packs officiels), refused (refusé,
-- fichier effacé). L'archive est dans R2 sous worlds/<id du compte>/omnipack.<id>/ : elle part
-- donc avec le compte s'il est supprimé.
CREATE TABLE IF NOT EXISTS "playPackSubmission" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "sizeBytes"  INTEGER NOT NULL,
  "sha256"     TEXT NOT NULL,
  "parts"      INTEGER NOT NULL,
  -- omnipack.json lu dans le navigateur au moment de l'envoi (vérifié par le site).
  "manifest"   TEXT NOT NULL DEFAULT '{}',
  "status"     TEXT NOT NULL DEFAULT 'uploading',
  "note"       TEXT,
  "packId"     TEXT,
  "createdAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS "playPackSubmission_user_idx" ON "playPackSubmission"("userId");
CREATE INDEX IF NOT EXISTS "playPackSubmission_status_idx" ON "playPackSubmission"("status");
