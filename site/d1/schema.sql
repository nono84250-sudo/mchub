-- Schema D1 (SQLite) : source de verite du projet (D1 est accede via l'API REST de
-- Cloudflare, voir src/lib/db.ts — pas de Prisma dans ce projet, migre entierement vers D1).
-- Conventions :
--   - Dates : TEXT au format ISO 8601 UTC (ex. 2026-10-06T12:00:00.000Z), comme TimestamptzString.
--   - Booleens : INTEGER 0/1.
--   - Enums : TEXT + CHECK. Valeurs identiques a Postgres.
--   - UUID : generes par l'application (D1 n'a pas de gen_random_uuid()).
--   - Pas de relations declarees en FK strictes sauf ON DELETE CASCADE (PRAGMA foreign_keys = ON requis par D1 session).


CREATE TABLE "user" (
  "id"                 TEXT PRIMARY KEY,
  "name"               TEXT NOT NULL,
  "minecraftUuid"      TEXT UNIQUE,
  "minecraftUsername"  TEXT,
  "sessionsValidAfter" TEXT,
  "createdAt"          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Verrou de compte (panel admin, fiche joueur) : distinct du gel par serveur
  -- (server.frozenAt, qui ne bloque qu'UN serveur). Ici c'est le compte entier qui
  -- ne peut plus s'authentifier dans le launcher (voir lib/launcherAuth.ts). Ajoute
  -- par ALTER TABLE, comme report.category.
  "lockedAt"           TEXT,
  "lockedReason"       TEXT,
  "lockedBy"           TEXT
);

CREATE TABLE "server" (
  "id"                       TEXT PRIMARY KEY,
  "slug"                     TEXT NOT NULL UNIQUE,
  "name"                     TEXT NOT NULL,
  "description"              TEXT NOT NULL,
  "bannerUrl"                TEXT,
  "iconUrl"                  TEXT,
  "backgroundUrl"            TEXT,
  "type"                     TEXT NOT NULL DEFAULT 'vanilla' CHECK ("type" IN ('vanilla', 'modded')),
  "minecraftVersion"         TEXT NOT NULL,
  "ip"                       TEXT NOT NULL,
  "curseforgeModpackId"      TEXT,
  "curseforgeModpackName"    TEXT,
  "curseforgeModpackVersion" TEXT,
  "modpackSource"            TEXT NOT NULL DEFAULT 'curseforge' CHECK ("modpackSource" IN ('curseforge', 'modrinth')),
  "playerCount"              INTEGER,
  "playerCapacity"           INTEGER,
  "lastPingedAt"             TEXT,
  "recommendedRamGB"         INTEGER,
  "published"                INTEGER NOT NULL DEFAULT 1,
  "frozenAt"                 TEXT,
  "frozenReason"             TEXT,
  "frozenBy"                 TEXT,
  "viewCount"                INTEGER NOT NULL DEFAULT 0,
  "launchCount"              INTEGER NOT NULL DEFAULT 0,
  "isPrivate"                INTEGER NOT NULL DEFAULT 0,
  "inviteCode"               TEXT UNIQUE,
  "discordUrl"               TEXT,
  "websiteUrl"               TEXT,
  "ownerId"                  TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt"                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- File de vérification (panel admin, voir lib/verification.ts) : ajoutées par ALTER
  -- TABLE, pas de CHECK sur verificationStatus (même raisonnement que "category" sur
  -- report ci-dessous — pas de reconstruction de table sur une base déjà peuplée).
  -- Défaut 'approved' : les fiches déjà publiées avant cette fonctionnalité restent
  -- visibles telles quelles, seules les fiches créées après entrent en 'pending'.
  "verificationStatus"       TEXT NOT NULL DEFAULT 'approved',
  "verificationChecks"       TEXT,
  "verificationHistory"      TEXT NOT NULL DEFAULT '[]',
  "verificationReason"       TEXT,
  -- Auto-test de publication lance depuis le launcher (voir lib/verification.ts et
  -- /api/launcher/servers/[slug]/self-test) : ajoutées par ALTER TABLE, même raisonnement
  -- que verificationStatus ci-dessus — NULL tant que le propriétaire n'a jamais fait passer
  -- les 3 contrôles (jointabilité, modpack, démarrage du jeu) avec succès. Complément au
  -- contrôle automatique du site (verificationChecks), jamais un
  -- remplacement : les deux sont montrés côte à côte à l'admin (voir verificationHtml).
  -- selfTestPassedAt est effacé par updateServer() dès que l'IP, la version déclarée ou le
  -- modpack changent (un ancien test réussi ne compte plus pour une config différente), et
  -- conditionne le passage privé -> public (voir ServerForm.tsx / NewServerWizard.tsx : toute
  -- nouvelle fiche est créée privée).
  "selfTestPassedAt"         TEXT,
  "selfTestDetectedVersion"  TEXT,
  -- Connexion automatique au serveur au lancement du jeu (Quick Play multijoueur, voir
  -- launcher/src/mcLaunch.js opts.quickPlay) — ajoutee par ALTER TABLE, meme raisonnement que
  -- verificationStatus ci-dessus. Uniquement disponible sur Minecraft 1.20+ (fonctionnalite
  -- Mojang) : le formulaire avertit le proprietaire si sa version declaree est anterieure, et
  -- le launcher ignore simplement l'option sur une version qui ne la supporte pas, mais l'IP
  -- est de toute facon toujours ajoutee a la liste Multijoueur (servers.dat), que la case soit
  -- cochee ou non. Vrai par defaut : comportement de lancement inchange pour les fiches
  -- existantes (decision du 2026-10-10).
  "autoConnect"              INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX "server_ownerId_idx" ON "server"("ownerId");

CREATE TABLE "serverEvent" (
  "id"        TEXT PRIMARY KEY,
  "serverId"  TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "kind"      TEXT NOT NULL CHECK ("kind" IN ('view', 'launch')),
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "serverEvent_serverId_kind_createdAt_idx" ON "serverEvent"("serverId", "kind", "createdAt");

CREATE TABLE "report" (
  "id"                        TEXT PRIMARY KEY,
  "serverId"                  TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "reporterMinecraftUuid"     TEXT NOT NULL,
  "reporterMinecraftUsername" TEXT NOT NULL,
  "issue"                     TEXT NOT NULL CHECK ("issue" IN ('cant_connect', 'wrong_version', 'modpack_download', 'crash', 'other')),
  "message"                   TEXT NOT NULL,
  "clientVersion"             TEXT,
  "launcherVersion"           TEXT,
  "status"                    TEXT NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'replied', 'resolved')),
  "reply"                     TEXT,
  "createdAt"                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Categorie "Comportement/contenu" (va aux moderateurs, jamais au proprietaire) : ajoutee
  -- par ALTER TABLE, pas de CHECK (comme banner/blockLauncher sur scheduledBroadcast) pour
  -- eviter une reconstruction de table sur une base deja peuplee. "issue" reste 'other' pour
  -- ces lignes (CHECK existant), le vrai motif est dans behaviorIssue (valide cote app).
  "category"                  TEXT NOT NULL DEFAULT 'technical',
  "behaviorIssue"             TEXT,
  "proofUrl"                  TEXT
);
CREATE INDEX "report_serverId_status_createdAt_idx" ON "report"("serverId", "status", "createdAt");
CREATE INDEX "report_category_status_createdAt_idx" ON "report"("category", "status", "createdAt");

CREATE TABLE "notification" (
  "id"                     TEXT PRIMARY KEY,
  "recipientMinecraftUuid" TEXT NOT NULL,
  "type"                   TEXT NOT NULL CHECK ("type" IN ('report_replied', 'report_resolved', 'server_frozen', 'admin_info', 'admin_warning', 'admin_error', 'broadcast_announcement', 'broadcast_maintenance', 'broadcast_alert', 'broadcast_promotion', 'verification_approved', 'verification_rejected')),
  "serverName"             TEXT NOT NULL,
  "message"                TEXT,
  "read"                   INTEGER NOT NULL DEFAULT 0,
  "createdAt"              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Instant UTC de l'evenement annonce (ex. debut d'une maintenance programmee), pour que
  -- chaque destinataire puisse l'afficher dans son propre fuseau cote client. NULL hors
  -- diffusion liee a une date/heure (voir lib/scheduledBroadcasts.ts).
  "eventAt"                TEXT
);
CREATE INDEX "notification_recipient_read_createdAt_idx" ON "notification"("recipientMinecraftUuid", "read", "createdAt");

CREATE TABLE "platformSetting" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "adminAccount" (
  "id"                    TEXT PRIMARY KEY,
  "username"              TEXT NOT NULL UNIQUE,
  "passwordHash"          TEXT NOT NULL,
  "role"                  TEXT NOT NULL,
  "mustChangeCredentials" INTEGER NOT NULL DEFAULT 1,
  "createdAt"             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Revoque les sessions admin emises AVANT le dernier changement de mot de passe (voir
  -- adminSession.ts, meme principe que user.sessionsValidAfter) — ajoutee par ALTER TABLE.
  -- Sans ca, un cookie de session vole restait valide jusqu'a 8h meme apres que l'admin ait
  -- change son mot de passe en pensant se proteger (trouve par l'audit du 2026-10-10).
  "passwordChangedAt"     TEXT
);

-- Diffusion programmee (panel admin, voir lib/scheduledBroadcasts.ts). "scheduledAt" est
-- toujours un instant UTC correct (l'admin saisit en heure de Belgique, voir lib/timezone.ts).
-- Traitee par /api/cron/process-scheduled, appelee par un petit Worker Cloudflare externe
-- (Vercel Hobby ne permet qu'une tache planifiee par jour, insuffisant ici).
CREATE TABLE "scheduledBroadcast" (
  "id"            TEXT PRIMARY KEY,
  "type"          TEXT NOT NULL CHECK ("type" IN ('announcement', 'maintenance', 'alert', 'promotion')),
  "audience"      TEXT NOT NULL CHECK ("audience" IN ('everyone', 'owners')),
  "system"        TEXT,
  "text"          TEXT NOT NULL,
  "banner"        INTEGER NOT NULL DEFAULT 0,
  -- N'active vraiment le blocage du launcher (voir launcher.maintenance) que si "type" vaut
  -- "maintenance" ET que ce champ est a 1 — sinon c'est juste une annonce comme les autres.
  "blockLauncher" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt"   TEXT NOT NULL,
  "sentAt"        TEXT,
  "createdAt"     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "scheduledBroadcast_due_idx" ON "scheduledBroadcast"("sentAt", "scheduledAt");

-- Avertissements d'un compte joueur (fiche joueur, panel admin).
CREATE TABLE "playerWarning" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "reason"    TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "playerWarning_userId_createdAt_idx" ON "playerWarning"("userId", "createdAt");

-- Notes privees entre admins sur un compte joueur (jamais montrees au joueur).
CREATE TABLE "adminNote" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "text"      TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "adminNote_userId_createdAt_idx" ON "adminNote"("userId", "createdAt");

-- Articles d'actualite (panel admin /admin/news), affiches sur la page "Actualites" du
-- dashboard une fois publies. Pas de type/auteur/image pour l'instant (voir la maquette,
-- volontairement simplifie).
CREATE TABLE "news" (
  "id"          TEXT PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "published"   INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TEXT,
  "createdAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "news_published_publishedAt_idx" ON "news"("published", "publishedAt");
