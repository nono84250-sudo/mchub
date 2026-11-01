-- Migration 2026-10-21 : 3e source de modpack « FTB » (packs officiels de l'equipe FTB, voir
-- lib/ftb.ts). La colonne server.modpackSource avait un CHECK limite a ('curseforge', 'modrinth') :
-- un serveur FTB serait refuse a l'enregistrement.
--
-- Pas de reconstruction de la table "server" (CREATE/copie/DROP) : avec les cles etrangeres
-- actives, le DROP TABLE declencherait les ON DELETE CASCADE et viderait serverEvent, report,
-- notification, etc. A la place, on remplace UNIQUEMENT la colonne : SQLite autorise DROP COLUMN
-- sur une colonne dont le seul CHECK est le sien. Nouvelle colonne SANS CHECK, comme
-- verificationStatus et modpackChannel : valeurs controlees par le code (parseModpackSource dans
-- lib/modpack-types.ts), 'curseforge' par defaut comme avant.
--
-- A lancer une seule fois, d'abord sur la base DEV (omniscient-launcher-dev), puis verifier :
--   SELECT "modpackSource", COUNT(*) FROM "server" GROUP BY 1;   -- memes chiffres qu'avant
-- NE PAS lancer sur la base de production sans l'accord explicite de l'utilisateur.
-- Entre le DROP et le RENAME (quelques millisecondes), une requete du site qui lit
-- modpackSource echouerait : lancer le fichier d'un seul bloc (wrangler d1 execute --file).
ALTER TABLE "server" ADD COLUMN "modpackSourceNew" TEXT NOT NULL DEFAULT 'curseforge';
UPDATE "server" SET "modpackSourceNew" = "modpackSource";
ALTER TABLE "server" DROP COLUMN "modpackSource";
ALTER TABLE "server" RENAME COLUMN "modpackSourceNew" TO "modpackSource";
