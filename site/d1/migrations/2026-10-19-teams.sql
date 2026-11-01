-- Migration 2026-10-19 : teams (fil « Team Omniscient et serveurs pilotes »). Choix de Rushi du
-- 19/10 (preview « Teams : choisir et plusieurs teams », option A + A) :
--   - chaque serveur choisit sa team, ou aucune (server.teamId) : interrupteurs dans « Ma team »,
--     liste « Team » a la creation d'un serveur et dans Paramètres ;
--   - une team d'office par compte ; une autre seulement sur demande avec une preuve, acceptee
--     par un admin (table teamRequest, page admin « Demandes de team »).
-- Voir lib/teams.ts et lib/teamRules.ts.
--   team.key        : forme comparable du nom (unicite sans accents ni majuscules)
--   team.renamedAt  : dernier changement de nom (un changement tous les 30 jours)
-- teamNameHold : un ancien nom (ou celui d'une team supprimee) reste bloque 30 jours ; l'ancien
-- lien /team/<ancien> redirige vers la team tant qu'elle existe.
-- Un serveur dont la team appartient a un autre compte (transfert de propriete) n'affiche
-- aucune team : la verification est faite a la lecture (lib/teams.ts, teamBadgeFor).
--
-- A lancer une seule fois. Lancee sur DEV le 19/10 (la premiere version, colonnes team* sur
-- "user", y a ete convertie puis retiree). NE PAS lancer sur la base de production sans
-- l'accord explicite de l'utilisateur (sinon laisser TEAMS_READY a false dans lib/teamRules.ts).
CREATE TABLE "team" (
  "id"          TEXT PRIMARY KEY,
  "ownerId"     TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL UNIQUE,
  "key"         TEXT NOT NULL UNIQUE,
  "iconUrl"     TEXT,
  "description" TEXT,
  "renamedAt"   TEXT,
  "createdAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "team_ownerId_idx" ON "team" ("ownerId");
ALTER TABLE "server" ADD COLUMN "teamId" TEXT REFERENCES "team" ("id") ON DELETE SET NULL;
CREATE INDEX "server_teamId_idx" ON "server" ("teamId");
CREATE TABLE "teamNameHold" (
  "key"    TEXT PRIMARY KEY,
  "slug"   TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "teamId" TEXT REFERENCES "team" ("id") ON DELETE SET NULL,
  "until"  TEXT NOT NULL
);
CREATE INDEX "teamNameHold_slug_idx" ON "teamNameHold" ("slug");
CREATE TABLE "teamRequest" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "name"         TEXT NOT NULL,
  "reason"       TEXT NOT NULL,
  "proof"        TEXT NOT NULL,
  "proofImageUrl" TEXT,
  "status"       TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'refused')),
  "refuseReason" TEXT,
  "teamId"       TEXT REFERENCES "team" ("id") ON DELETE SET NULL,
  "decidedBy"    TEXT,
  "decidedAt"    TEXT,
  "createdAt"    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "teamRequest_status_idx" ON "teamRequest" ("status", "createdAt");
CREATE INDEX "teamRequest_userId_idx" ON "teamRequest" ("userId");
