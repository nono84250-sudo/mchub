-- Migration 2026-10-14 : amis par demande puis accord (voir lib/friends.ts et la table
-- "friendship" dans ../schema.sql). A executer UNE fois sur une base qui a deja la table
-- "friendship" de la phase 1 (ajout direct). Une base creee depuis schema.sql a jour n'en a
-- pas besoin.
--
-- NE PAS lancer sur la base de production sans l'accord explicite de l'utilisateur.
--
-- Colonnes ajoutees en fin de table (SQLite/D1 ne sait pas en inserer au milieu) : meme ordre
-- que dans schema.sql, ou elles sont aussi placees en dernier.
ALTER TABLE "friendship" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "friendship" ADD COLUMN "requesterId" TEXT REFERENCES "user"("id") ON DELETE CASCADE;

-- Amities deja creees avec l'ancien systeme. Choix par defaut : on les garde comme amities
-- acceptees (rien n'est supprime ; il s'agit des comptes de test).
UPDATE "friendship" SET "status" = 'accepted';
-- Alternative si l'on prefere repartir de zero, puisque ces amities ont ete creees sans
-- l'accord de l'autre joueur : remplacer la ligne UPDATE ci-dessus par
--   DELETE FROM "friendship";
