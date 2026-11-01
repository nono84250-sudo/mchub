-- Migration 2026-10-19 : releve horaire des joueurs + historique du « Petit serveur du jour ».
-- Sert a calculer la moyenne et le pic de joueurs par jour (stats pour les createurs, et un
-- « petit serveur actif » plus juste) et a garantir qu'un serveur n'est pas choisi deux fois en
-- 7 jours. Ecrit par le cron toutes les heures (une insertion groupee par heure, ~24 appels D1
-- par jour), lu une fois par jour par le calcul du serveur du jour.
--
-- PAS ENCORE LANCEE. A lancer seulement apres le « oui » ecrit de Rushi, d'abord sur la base
-- DEV. NE PAS lancer sur la base de production sans son accord explicite. Le code actuel n'en
-- depend pas : le serveur du jour marche sans ces tables (calcul sans historique).
CREATE TABLE IF NOT EXISTS "serverPlayerSample" (
  "serverId"  TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  -- Heure du releve, arrondie a l'heure (UTC), ex. 2026-10-19T17:00:00Z.
  "hour"      TEXT NOT NULL,
  "players"   INTEGER,
  PRIMARY KEY ("serverId", "hour")
);
CREATE INDEX IF NOT EXISTS "serverPlayerSample_hour_idx" ON "serverPlayerSample"("hour");

CREATE TABLE IF NOT EXISTS "serverDayPick" (
  -- Jour (heure de Bruxelles), ex. 2026-10-19.
  "day"       TEXT PRIMARY KEY,
  "serverId"  TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
