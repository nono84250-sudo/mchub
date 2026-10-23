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
  "autoConnect"              INTEGER NOT NULL DEFAULT 1,
  -- Recours contre un gel (voir lib/appeals.ts) : "second avis obligatoire à effet suspensif"
  -- plutot qu'une messagerie — reutilise le pattern verificationStatus/verificationHistory
  -- ci-dessus. Ajoutees par ALTER TABLE, pas de CHECK sur appealStatus (meme raisonnement que
  -- verificationStatus). NULL = jamais demande ; 'pending' = en attente d'une decision ;
  -- 'resolved' = tranche (gel confirme, annule, ou auto-degele apres 72h sans decision, voir
  -- appealHistory et /api/cron/process-appeals).
  "appealStatus"             TEXT,
  "appealRequestedAt"        TEXT,
  -- Instant UTC a partir duquel /api/cron/process-appeals degele automatiquement si personne
  -- n'a tranche (appelee toutes les 5 min par cron-worker/src/index.js).
  "appealDeadline"           TEXT,
  -- Admin charge de statuer (id, pas username comme frozenBy), choisi a la demande du
  -- proprietaire parmi les admins AUTRES que frozenBy : vrai "second avis" si un autre admin
  -- existe. Reste NULL s'il n'y a qu'un seul admin actif — c'est alors le meme admin qui gele
  -- qui reexamine passe le delai (auto-revision, jamais affichee comme un second avis au
  -- proprietaire, voir lib/appeals.ts).
  "appealAssignedAdminId"    TEXT,
  "appealHistory"            TEXT NOT NULL DEFAULT '[]',
  -- Canal de suivi du modpack (CurseForge ET Modrinth, voir lib/curseforge.ts et
  -- lib/modrinth.ts) : ajoutee par ALTER TABLE, meme raisonnement que verificationStatus
  -- ci-dessus — pas de CHECK, valeurs applicatives 'release' (defaut, stable uniquement) ou
  -- 'beta' (accepte aussi les versions beta du modpack, en plus des releases). Choisi dans
  -- ModpackPicker.tsx (creation/edition) ou depuis le launcher (voir
  -- /api/launcher/servers/[slug]/channel) — les deux ecrivent la meme colonne.
  "modpackChannel"           TEXT NOT NULL DEFAULT 'release',
  -- Fiche publique personnalisable (voir lib/serverPage.ts, migration 2026-10-16) : JSON en
  -- choix fermes, jamais de HTML/CSS libre. NULL = fiche par defaut. Ajoutee par ALTER TABLE.
  "pageConfig"               TEXT
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

-- « Prévenir le serveur » (2026-10-17) : rapports d'echec d'installation envoyes par les joueurs.
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

CREATE TABLE "notification" (
  "id"                     TEXT PRIMARY KEY,
  "recipientMinecraftUuid" TEXT NOT NULL,
  -- 'instance_back_online' ajoute le 2026-10-14 (point 9, suivi de statut d'instance) : la table
  -- a ete RECREEE (CREATE + INSERT SELECT + DROP + RENAME, pas un simple ALTER) car SQLite ne
  -- permet pas de modifier un CHECK existant — donnees existantes verifiees avant/apres (voir
  -- lib/instanceWatch.ts et /api/cron/process-instance-watch).
  "type"                   TEXT NOT NULL CHECK ("type" IN ('report_replied', 'report_resolved', 'server_frozen', 'admin_info', 'admin_warning', 'admin_error', 'broadcast_announcement', 'broadcast_maintenance', 'broadcast_alert', 'broadcast_promotion', 'verification_approved', 'verification_rejected', 'instance_back_online')),
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

-- Suivi par joueur/instance (point 9, 2026-10-14) : case "Me prevenir du changement de statut
-- de cette instance" (voir INSTANCE_SETTINGS_FIELDS cote launcher et /api/launcher/servers/[slug]/watch).
-- S'applique a TOUTE instance de "Mes instances" (possedee OU rejointe), pas seulement les
-- favoris — d'ou une table dediee plutot qu'une colonne sur server (qui n'a qu'UN proprietaire).
-- lastKnownOnline retient le dernier etat mesure par /api/cron/process-instance-watch pour ne
-- notifier QUE la transition hors-ligne -> en-ligne (jamais l'inverse, voir ce fichier), sans
-- redondance si le serveur reste en ligne sur plusieurs passages du cron.
CREATE TABLE "instanceWatch" (
  "id"                   TEXT PRIMARY KEY,
  "minecraftUuid"        TEXT NOT NULL,
  "serverId"             TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "notifyOnStatusChange" INTEGER NOT NULL DEFAULT 0,
  "lastKnownOnline"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Une ligne par (joueur, serveur) : la route watch fait un select avant insert/update sur cette
-- paire (pas d'UPSERT natif cote petite couche db.ts, voir lib/instanceWatch.ts).
CREATE UNIQUE INDEX "instanceWatch_minecraftUuid_serverId_idx" ON "instanceWatch"("minecraftUuid", "serverId");
-- Filtre principal du cron (WHERE notifyOnStatusChange = 1).
CREATE INDEX "instanceWatch_notify_idx" ON "instanceWatch"("notifyOnStatusChange");

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

-- Amities (systeme d'amis, 2026-10-14, voir lib/friends.ts) : une ligne par paire, jamais deux
-- (A-B et B-A). Deduplication par l'application : lib/friends.ts range toujours les deux id dans
-- le meme ordre (le plus petit en userId1) avant d'ecrire, donc l'index unique ci-dessous suffit
-- a empecher un doublon quel que soit l'ordre d'ajout. Demande puis accord (corrige le
-- 2026-10-14, avant : ajout direct sans accord) : "pending" = demande envoyee par requesterId,
-- en attente de l'autre joueur ; "accepted" = amitie confirmee des deux cotes. Refuser, annuler
-- ou retirer = supprimer la ligne. Pas de CHECK sur "status" (valeurs applicatives), meme
-- raisonnement que verificationStatus. Migration d'une base existante :
-- d1/migrations/2026-10-14-demandes-amis.sql.
CREATE TABLE "friendship" (
  "id"          TEXT PRIMARY KEY,
  "userId1"     TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "userId2"     TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt"   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "requesterId" TEXT REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendship"("userId1", "userId2");
-- Recherche "de qui suis-je l'ami" dans l'autre sens (userId2) : userId1 est deja couvert par
-- l'index unique ci-dessus (prefixe de gauche).
CREATE INDEX "friendship_userId2_idx" ON "friendship"("userId2");

-- Presence (heartbeat envoye par le launcher, 2026-10-14, voir /api/launcher/presence) :
-- table SEPAREE de "user" expres -- ecrite a chaque cycle de 60s du launcher (REFRESH_INTERVAL_MS
-- cote renderer.js) pour TOUS les joueurs connectes, alors que "user" reste une table peu
-- ecrite (connexion, changement de pseudo). Le statut "en ligne" n'est PAS stocke ici : calcule
-- a la LECTURE (lastSeenAt dans les ~2 dernieres minutes, soit 2x le cycle de 60s, marge pour un
-- cycle manque) par lib/presence.ts.
CREATE TABLE "userPresence" (
  "userId"     TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "lastSeenAt" TEXT NOT NULL,
  -- Serveur public en cours de partie (filtre « Un ami y joue », migration 2026-10-16) : NULL
  -- hors partie ou sur un serveur prive. Montre uniquement aux amis acceptes.
  "playingSlug" TEXT,
  "createdAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Comptes supprimes par leur proprietaire (2026-10-14, voir lib/users.ts) : empreinte SHA-256
-- de l'UUID Minecraft seulement (pas de pseudo, pas d'id), pour que le signal de presence du
-- launcher ne recree pas le compte tout seul. Retiree quand le joueur revient de lui-meme.
CREATE TABLE "deletedAccount" (
  "minecraftUuidHash" TEXT PRIMARY KEY,
  "deletedAt"         TEXT NOT NULL
);

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

-- Formulaire de contact public (/contact), 2026-10-14 : aucun email n'est envoye (aucune
-- infra de ce genre dans ce projet, voir lib/db.ts) -- le message est juste enregistre ici
-- et lu depuis le panel admin (/admin/contact), meme esprit que "report" plus haut mais sans
-- lien avec un serveur ni un compte (visiteur public, pas forcement connecte). Pas de CHECK
-- sur "status" (valeurs applicatives 'new'/'read'), meme raisonnement que verificationStatus
-- ci-dessus.
CREATE TABLE "contactMessage" (
  "id"        TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'new',
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "contactMessage_status_createdAt_idx" ON "contactMessage"("status", "createdAt");

-- Demandes d'etiquettes (2026-10-16, voir lib/tagRequests.ts, lib/tagCatalog.ts et
-- migrations/2026-10-16-demandes-etiquettes.sql). Les etiquettes en dur (PAGE_TAGS) restent la
-- base ; customTag (id en "c-...") et tagAlias (mot normalise -> etiquette) les completent.
-- tagRequest.word n'est jamais affiche en public. status : pending | accepted | merged | refused.
CREATE TABLE "tagRequest" (
  "id"           TEXT PRIMARY KEY,
  "serverId"     TEXT NOT NULL REFERENCES "server"("id") ON DELETE CASCADE,
  "ownerUserId"  TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "word"         TEXT NOT NULL,
  "normalized"   TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "resultTagId"  TEXT,
  "refuseReason" INTEGER,
  "createdAt"    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "decidedAt"    TEXT
);
CREATE INDEX "tagRequest_status_idx" ON "tagRequest"("status", "createdAt");
CREATE INDEX "tagRequest_normalized_idx" ON "tagRequest"("normalized");
CREATE INDEX "tagRequest_server_idx" ON "tagRequest"("serverId");
CREATE INDEX "tagRequest_owner_idx" ON "tagRequest"("ownerUserId", "createdAt");

CREATE TABLE "customTag" (
  "id"        TEXT PRIMARY KEY,
  "nameFr"    TEXT NOT NULL,
  "nameEn"    TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "tagAlias" (
  "normalized" TEXT PRIMARY KEY,
  "tagId"      TEXT NOT NULL,
  "createdAt"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
