-- Double authentification (TOTP) du panel admin, 2026-10-15. Voir lib/adminTotp.ts.
-- A lancer UNE fois par base. Sur omniscient-prod seulement avec l'accord ecrit de Rushi,
-- en meme temps que la mise en ligne du code (l'ancien code ignore ces colonnes, le nouveau
-- en a besoin). Apres la mise en ligne, chaque membre du staff configure sa 2FA a sa
-- prochaine connexion.
ALTER TABLE "adminAccount" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "adminAccount" ADD COLUMN "totpEnabledAt" TEXT;
ALTER TABLE "adminAccount" ADD COLUMN "totpLastStep" INTEGER;
ALTER TABLE "adminAccount" ADD COLUMN "totpFailedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "adminAccount" ADD COLUMN "totpLockedUntil" TEXT;
ALTER TABLE "adminAccount" ADD COLUMN "totpRecoveryCodes" TEXT;
