-- Panel Analytique (31/10, preview validée par Rushi) : qui est en ligne sur le site, et les pics
-- par heure. Migration ADDITIVE uniquement (2 nouvelles tables) : rien d'existant n'est modifié.
-- Le launcher ne change pas : ses chiffres viennent de "userPresence", déjà là.

-- Visiteurs du site vus dans les 2 dernières minutes. Une ligne vit 2 minutes puis est effacée
-- (voir lib/analytics.ts). Ni IP, ni navigateur, ni page visitée. visitorId : identifiant au hasard
-- gardé dans le navigateur. userId : compte connecté, sinon NULL ; volontairement sans clé
-- étrangère (un compte tout juste supprimé ne doit pas faire échouer le lot d'écritures).
CREATE TABLE "analyticsSiteVisitor" (
  "visitorId"  TEXT PRIMARY KEY,
  "userId"     TEXT,
  "lastSeenAt" TEXT NOT NULL
);
CREATE INDEX "analyticsSiteVisitor_lastSeenAt_idx" ON "analyticsSiteVisitor"("lastSeenAt");

-- Pics par heure (heure de Bruxelles) : des totaux seulement, aucune trace individuelle.
CREATE TABLE "analyticsDaily" (
  "day"          TEXT NOT NULL,
  "hour"         INTEGER NOT NULL,
  "launcherPeak" INTEGER NOT NULL DEFAULT 0,
  "sitePeak"     INTEGER NOT NULL DEFAULT 0,
  "totalPeak"    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("day", "hour")
);
