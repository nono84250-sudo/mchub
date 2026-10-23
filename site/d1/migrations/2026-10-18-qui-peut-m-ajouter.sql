-- Migration 2026-10-18 : « Qui peut m'ajouter en ami » (variante C validée par Rushi le 18/10).
-- friendPolicy : 'all' (tout le monde, par pseudo), 'code' (seulement avec le code d'ami),
-- 'none' (personne). Défaut 'code', y compris pour les comptes existants (plus sûr pour les
-- enfants). friendCode : 6 caractères sans 0/O/1/I/L, stocké sans tiret, créé à la première
-- ouverture de la page Amis (voir lib/friendPrivacy.ts). Un ALTER TABLE ne peut pas ajouter
-- une colonne UNIQUE dans SQLite : l'unicité passe par un index.
--
-- A lancer une seule fois. Lancée sur la base DEV (omniscient-launcher-dev) le 18/10.
-- NE PAS lancer sur la base de production sans l'accord explicite de
-- l'utilisateur.
ALTER TABLE "user" ADD COLUMN "friendPolicy" TEXT NOT NULL DEFAULT 'code';
ALTER TABLE "user" ADD COLUMN "friendCode" TEXT;
CREATE UNIQUE INDEX "user_friendCode_key" ON "user" ("friendCode");
