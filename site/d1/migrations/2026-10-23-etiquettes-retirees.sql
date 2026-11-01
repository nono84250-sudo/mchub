-- Migration 2026-10-23 : etiquettes retirees (page admin /admin/etiquettes, liste « Etiquettes
-- existantes », bouton « Retirer » ; voir lib/tagRequests.ts removeTag et lib/tagCatalog.ts).
-- Une ligne customTag avec "removedAt" rempli = etiquette retiree de la liste (ajoutee ou en dur).
-- Le site marche aussi sans cette colonne (lecture de secours), seul « Retirer » echoue.
--
-- A lancer UNE fois (ALTER TABLE ne se relance pas). Une base creee depuis schema.sql a jour n'en a pas besoin.
-- Appliquee sur la base DEV (omniscient-launcher-dev) le 23/10.
--
-- NE PAS lancer sur la base de production sans l'accord explicite de l'utilisateur.
ALTER TABLE "customTag" ADD COLUMN "removedAt" TEXT;
