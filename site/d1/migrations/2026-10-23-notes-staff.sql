-- Suppression des notes du staff (23/10, demande de Rushi).
-- 1) adminNote.kind : "note" (ecrite par le staff, supprimable par le proprietaire) ou "export"
--    (trace automatique d'un export des donnees d'un joueur, verrouillee pour tout le monde).
ALTER TABLE "adminNote" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'note';
-- Les traces d'export deja ecrites avant cette colonne (texte fixe de api/admin/player-export).
UPDATE "adminNote" SET "kind" = 'export' WHERE "text" LIKE 'Export des données généré%';

-- 2) adminAccount.isOwner : proprietaire du site. Pas un role : aucune route ne le donne, et
--    l'index unique empeche d'avoir deux proprietaires.
ALTER TABLE "adminAccount" ADD COLUMN "isOwner" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "adminAccount_isOwner_idx" ON "adminAccount"("isOwner") WHERE "isOwner" = 1;
-- Compte de Rushi. En PROD, verifier d'abord le nom du compte (SELECT "username" FROM "adminAccount").
UPDATE "adminAccount" SET "isOwner" = 1 WHERE "username" = 'Rushifa';
