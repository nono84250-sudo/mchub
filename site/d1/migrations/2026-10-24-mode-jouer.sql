-- Mode « Jouer » (bêta, 24/10, variante C validée par Rushi) : packs officiels, offres
-- (Gratuit / Supporter), mondes sauvegardés en ligne. A passer sur la base DEV d'abord ; la PROD
-- seulement avec l'accord de Rushi au moment de la mise en ligne.

-- Packs officiels : une liste de mods Modrinth (rien n'est hébergé chez nous), préparée par
-- version de Minecraft dans l'admin (« Packs officiels »).
CREATE TABLE "playPack" (
  "id"            TEXT PRIMARY KEY,
  "slug"          TEXT NOT NULL UNIQUE,
  "nameFr"        TEXT NOT NULL,
  "nameEn"        TEXT NOT NULL,
  "descriptionFr" TEXT NOT NULL DEFAULT '',
  "descriptionEn" TEXT NOT NULL DEFAULT '',
  -- Liste de départ : identifiants ou slugs de projets Modrinth (JSON ["sodium", "lithium", ...]).
  "modrinthProjects" TEXT NOT NULL DEFAULT '[]',
  "createdAt"     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Une ligne par version de Minecraft préparée. status : tested (Testée), to_test (À tester),
-- review (À revoir), not_enough (Pas assez de mods). Seules les lignes published = 1 sont
-- proposées dans le launcher.
CREATE TABLE "playPackVersion" (
  "id"               TEXT PRIMARY KEY,
  "packId"           TEXT NOT NULL REFERENCES "playPack"("id") ON DELETE CASCADE,
  "minecraftVersion" TEXT NOT NULL,
  "loader"           TEXT NOT NULL DEFAULT 'fabric',
  "loaderVersion"    TEXT,
  -- JSON [{ "projectId", "title", "url" (cdn.modrinth.com), "filename", "sha1", "size" }]
  "files"            TEXT NOT NULL DEFAULT '[]',
  -- JSON [{ "projectId", "title" }] : mods de la liste sans fichier pour cette version.
  "missing"          TEXT NOT NULL DEFAULT '[]',
  "status"           TEXT NOT NULL DEFAULT 'to_test',
  "published"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX "playPackVersion_pack_mc_idx" ON "playPackVersion"("packId", "minecraftVersion");

-- Offres : le quota et la durée de conservation viennent d'ici, jamais du code.
CREATE TABLE "playOffer" (
  "id"          TEXT PRIMARY KEY,
  "nameFr"      TEXT NOT NULL,
  "nameEn"      TEXT NOT NULL,
  "cloud"       INTEGER NOT NULL DEFAULT 0,
  "quotaBytes"  INTEGER NOT NULL DEFAULT 0,
  "keepDays"    INTEGER NOT NULL DEFAULT 30,
  "priceCents"  INTEGER NOT NULL DEFAULT 0,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "playOffer" ("id", "nameFr", "nameEn", "cloud", "quotaBytes", "keepDays", "priceCents", "sortOrder") VALUES
  ('free', 'Gratuit', 'Free', 0, 0, 0, 0, 0),
  ('supporter', 'Supporter', 'Supporter', 1, 10000000000, 30, 299, 1);

-- Offre d'un joueur. Pas de ligne = Gratuit. source : 'simulated' (réglée dans l'admin pour les
-- tests, tant que le paiement n'existe pas) ; plus tard 'payment'.
CREATE TABLE "userPlayOffer" (
  "userId"    TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "offerId"   TEXT NOT NULL REFERENCES "playOffer"("id"),
  "source"    TEXT NOT NULL DEFAULT 'simulated',
  "expiresAt" TEXT,
  "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Monde en ligne d'un joueur (worldKey = clé écrite par le launcher dans omniscient-world.json).
CREATE TABLE "cloudWorld" (
  "id"               TEXT PRIMARY KEY,
  "userId"           TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "worldKey"         TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "minecraftVersion" TEXT,
  "packName"         TEXT,
  -- Version choisie sur le site (« Restaurer ») : appliquée par le launcher au prochain lancement.
  "restoreVersionId" TEXT,
  "createdAt"        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX "cloudWorld_user_key_idx" ON "cloudWorld"("userId", "worldKey");

-- Chaque envoi terminé et vérifié = une version (fichier .zip dans R2, préfixe worlds/).
CREATE TABLE "cloudWorldVersion" (
  "id"               TEXT PRIMARY KEY,
  "worldId"          TEXT NOT NULL REFERENCES "cloudWorld"("id") ON DELETE CASCADE,
  "userId"           TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "objectKey"        TEXT NOT NULL,
  "sizeBytes"        INTEGER NOT NULL,
  "sha256"           TEXT NOT NULL,
  "minecraftVersion" TEXT,
  "reason"           TEXT,
  "createdAt"        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "cloudWorldVersion_world_idx" ON "cloudWorldVersion"("worldId", "createdAt");
CREATE INDEX "cloudWorldVersion_user_idx" ON "cloudWorldVersion"("userId");

-- Envois en cours (multipart R2) : permet de reprendre après une coupure, et de nettoyer ceux
-- abandonnés (expiresAt).
CREATE TABLE "cloudUpload" (
  "id"               TEXT PRIMARY KEY,
  "userId"           TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "worldKey"         TEXT NOT NULL,
  "uploadId"         TEXT NOT NULL,
  "objectKey"        TEXT NOT NULL,
  "sizeBytes"        INTEGER NOT NULL,
  "sha256"           TEXT NOT NULL,
  "partSize"         INTEGER NOT NULL,
  -- JSON { name, minecraftVersion, packName, reason }
  "meta"             TEXT NOT NULL DEFAULT '{}',
  "createdAt"        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "expiresAt"        TEXT NOT NULL
);
CREATE INDEX "cloudUpload_user_idx" ON "cloudUpload"("userId");
