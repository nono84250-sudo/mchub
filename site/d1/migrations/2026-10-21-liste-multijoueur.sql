-- Liste Multijoueur (21/10) : le proprietaire choisit si le launcher ecrit l'adresse de son
-- serveur dans servers.dat du joueur (voir launcher/src/mcLaunch.js et site/d1/schema.sql).
-- 1 par defaut : rien ne change pour les fiches existantes.
-- DEV uniquement pour l'instant (omniscient-launcher-dev), avec le « oui » ecrit de Rushi.
-- PROD : seulement avec son accord, avant la mise en ligne du code qui lit cette colonne.
ALTER TABLE "server" ADD COLUMN "addToServerList" INTEGER NOT NULL DEFAULT 1;
