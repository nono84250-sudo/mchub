-- Migration 2026-10-17 : « Prévenir le serveur » (design du launcher, point 6, preview validee par
-- Rushi). Quand une installation ou un lancement echoue, le joueur peut envoyer en un clic un
-- rapport au proprietaire : type d'erreur, phrase lisible, versions et 200 dernieres lignes du
-- journal (jamais son e-mail ni son compte Microsoft). Le proprietaire les voit regroupes dans
-- /manage/[id]/reports (« 3 joueurs · aujourd'hui »). Voir lib/installProblems.ts.
--
-- A lancer une seule fois. NE PAS lancer sur la base de production sans l'accord explicite de
-- l'utilisateur.
CREATE TABLE "installProblem" (
  "id"                    TEXT PRIMARY KEY,
  "serverId"              TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "reporterMinecraftUuid" TEXT NOT NULL,
  "kind"                  TEXT NOT NULL CHECK ("kind" IN ('disk', 'net', 'crash', 'manual_mods', 'other')),
  "summary"               TEXT NOT NULL,
  "detail"                TEXT,
  "launcherVersion"       TEXT,
  "minecraftVersion"      TEXT,
  "logTail"               TEXT,
  "createdAt"             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "installProblem_serverId_createdAt_idx" ON "installProblem"("serverId", "createdAt");
