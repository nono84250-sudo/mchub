-- 25/10 : versions gardées en ligne par monde, au maximum, selon l'offre (le joueur en choisit
-- 1 à ce nombre dans le launcher, 3 par défaut). Quota en Go normaux : 10 Go = 10 000 000 000 octets
-- (avant : 10 Gio, affiché « 10,7 Go »).
ALTER TABLE "playOffer" ADD COLUMN "cloudVersions" INTEGER NOT NULL DEFAULT 10;
UPDATE "playOffer" SET "quotaBytes" = 10000000000 WHERE "id" = 'supporter' AND "quotaBytes" = 10737418240;
