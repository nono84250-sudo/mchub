-- Mode Jouer, plusieurs PC (24/10) : quel appareil a joué en dernier un monde du cloud, s'il est
-- ouvert en ce moment (verrou avec battement de cœur : un verrou périmé ne bloque pas), et les
-- deux versions gardées quand deux PC ont avancé chacun de leur côté (rien n'est écrasé).
-- DEV d'abord ; PROD seulement avec l'accord de Rushi.

-- Version à continuer (NULL = la plus récente) et, en cas de partie jouée des deux côtés,
-- l'autre version à proposer (« 2 versions de ce monde · Choisir laquelle continuer »).
ALTER TABLE "cloudWorld" ADD COLUMN "headVersionId" TEXT;
ALTER TABLE "cloudWorld" ADD COLUMN "splitVersionId" TEXT;
-- Dernier appareil qui a ouvert le monde.
ALTER TABLE "cloudWorld" ADD COLUMN "lastDeviceId" TEXT;
ALTER TABLE "cloudWorld" ADD COLUMN "lastDeviceName" TEXT;
ALTER TABLE "cloudWorld" ADD COLUMN "lastPlayedAt" TEXT;
-- Monde ouvert en ce moment (verrou) : appareil, depuis quand, dernier battement de cœur.
ALTER TABLE "cloudWorld" ADD COLUMN "openDeviceId" TEXT;
ALTER TABLE "cloudWorld" ADD COLUMN "openDeviceName" TEXT;
ALTER TABLE "cloudWorld" ADD COLUMN "openSince" TEXT;
ALTER TABLE "cloudWorld" ADD COLUMN "openBeatAt" TEXT;

-- Appareil qui a envoyé chaque version, et la version dont sa copie était partie.
ALTER TABLE "cloudWorldVersion" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "cloudWorldVersion" ADD COLUMN "deviceName" TEXT;
ALTER TABLE "cloudWorldVersion" ADD COLUMN "baseVersionId" TEXT;

-- Versions miroir (retour de Rushi du 25/10 : les 10 sauvegardes du PC doivent être sur le site) :
-- sauvegarde locale d'origine (anti-doublon et lien avec le launcher) et son nom donné par le joueur.
ALTER TABLE "cloudWorldVersion" ADD COLUMN "backupId" TEXT;
ALTER TABLE "cloudWorldVersion" ADD COLUMN "label" TEXT;
CREATE INDEX "cloudWorldVersion_backup_idx" ON "cloudWorldVersion"("worldId", "backupId");
