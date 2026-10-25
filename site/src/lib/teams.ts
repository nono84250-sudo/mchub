import { unstable_cache } from "next/cache";
import { execSql } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { isOwnImageUrl } from "@/lib/ownImageUrl";
import { deleteR2ImageIfOwned, imageKeyFromUrl, imagesUsedByAnotherOwner } from "@/lib/serverImages";
import {
  OFFICIAL_TEAM_SLUG,
  TEAM_FREE_COUNT,
  TEAM_HOLD_DAYS,
  TEAM_RENAME_DAYS,
  TEAMS_READY,
  cleanTeamDescription,
  cleanTeamName,
  reservedNameImitated,
  teamDescriptionError,
  teamKey,
  teamNamesClash,
  teamNameError,
  teamRequestError,
  teamSlug,
  type TeamBadge,
  type TeamDescriptionError,
  type TeamNameError,
  type TeamRequestError,
} from "@/lib/teamRules";

// Teams (fil « Team Omniscient et serveurs pilotes », 19/10). Choix de Rushi (preview « Teams :
// choisir et plusieurs teams », A + A) : une team est une ligne de la table "team" (migration
// d1/migrations/2026-10-19-teams.sql), et CHAQUE serveur choisit la sienne ou aucune
// (server.teamId) : interrupteurs dans « Ma team », liste « Team » a la creation et dans
// Paramètres. Jusqu'a 3 teams par compte (TEAM_FREE_COUNT, 20/10) ; au-dela seulement sur demande
// avec une preuve, acceptee par un admin (table teamRequest, page admin « Teams », onglet Demandes). Les regles pures
// (longueurs, mots interdits, noms reserves) sont dans lib/teamRules.ts, partagees avec l'editeur.

// Colonnes lues avec un serveur (include("team"), lib/db.ts) : ownerId sert a teamBadgeFor.
export const TEAM_COLUMNS = ["ownerId", "name", "slug", "iconUrl", "description"] as const;

type TeamRow = { id?: string; ownerId?: string; name?: string | null; slug?: string | null; iconUrl?: string | null; description?: string | null };

function badge(id: string, team: TeamRow): TeamBadge | null {
  if (!team.name || !team.slug) return null;
  return {
    id,
    name: team.name,
    slug: team.slug,
    iconUrl: team.iconUrl ?? null,
    description: team.description ?? null,
    official: team.slug === OFFICIAL_TEAM_SLUG,
  };
}

// Team affichee pour un serveur, ou null. Un serveur transfere a un autre compte garde son
// ancien teamId tant que le nouveau proprietaire n'a rien choisi : il n'affiche alors AUCUNE
// team (la team d'un compte ne s'affiche que sur les serveurs de ce compte).
export function teamBadgeFor(server: { teamId?: string | null; ownerId?: string | null; team?: TeamRow | null }): TeamBadge | null {
  if (!TEAMS_READY || !server.teamId || !server.team) return null;
  if (server.ownerId && server.team.ownerId && server.team.ownerId !== server.ownerId) return null;
  return badge(server.teamId, server.team);
}

export type MyTeam = TeamBadge & { renameAllowedAt: string | null };
export type MyServer = { id: string; slug: string; name: string; iconUrl: string | null; teamId: string | null };
export type MyTeamRequest = { id: string; name: string; status: "pending" | "accepted" | "refused"; refuseReason: string | null; createdAt: string };

export async function listMyTeams(userId: string): Promise<MyTeam[]> {
  if (!TEAMS_READY) return [];
  const rows = (await execSql(
    'SELECT "id", "name", "slug", "iconUrl", "description", "renamedAt" FROM "team" WHERE "ownerId" = ? ORDER BY "createdAt"',
    [userId],
  )) as (TeamRow & { id: string; renamedAt: string | null })[];
  return rows.flatMap((r) => {
    const b = badge(r.id, r);
    return b ? [{ ...b, renameAllowedAt: renameAllowedAt(r.renamedAt) }] : [];
  });
}

// Tout l'onglet « Ma team » en un appel : teams du compte, ses serveurs (avec leur team, remise a
// null si elle n'est pas a lui) et sa derniere demande de team.
export async function getTeamDashboard(userId: string): Promise<{ teams: MyTeam[]; servers: MyServer[]; lastRequest: MyTeamRequest | null }> {
  if (!TEAMS_READY) return { teams: [], servers: [], lastRequest: null };
  const [teams, servers, requests] = await Promise.all([
    listMyTeams(userId),
    execSql('SELECT "id", "slug", "name", "iconUrl", "teamId" FROM "server" WHERE "ownerId" = ? ORDER BY "createdAt"', [userId]) as Promise<MyServer[]>,
    execSql(
      'SELECT "id", "name", "status", "refuseReason", "createdAt" FROM "teamRequest" WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 1',
      [userId],
    ) as Promise<MyTeamRequest[]>,
  ]);
  const own = new Set(teams.map((t) => t.id));
  return {
    teams,
    servers: servers.map((s) => ({ ...s, teamId: s.teamId && own.has(s.teamId) ? s.teamId : null })),
    lastRequest: requests[0] ?? null,
  };
}

function renameAllowedAt(renamedAt: string | null): string | null {
  if (!renamedAt) return null;
  const at = new Date(renamedAt).getTime() + TEAM_RENAME_DAYS * 86_400_000;
  return at > Date.now() ? new Date(at).toISOString() : null;
}

export type TeamSaveError = TeamNameError | TeamDescriptionError | "nameTaken" | "renameTooSoon" | "icon" | "teamLimit" | "generic";
export type TeamSaveInput = { name: string; description: string; iconUrl: string | null };

// Le nom est-il pris : autre team (nom ou lien), nom bloque par un autre compte, ou serveur d'un
// autre compte qui porte ce nom (on ne se fait pas passer pour un serveur). Un appel.
// Pour un joueur, une team d'un autre compte qui a le meme nom « plie » (« Luci0les » contre
// « Lucioles », lib/teamRules.ts) compte aussi comme prise.
async function nameTaken(key: string, slug: string, name: string, userId: string, exceptTeamId: string | null, isAdmin: boolean): Promise<boolean> {
  const now = new Date().toISOString();
  const others = isAdmin
    ? []
    : ((await execSql('SELECT "name" FROM "team" WHERE "ownerId" != ? AND "id" != ?', [userId, exceptTeamId ?? ""])) as { name: string }[]);
  if (others.some((t) => teamNamesClash(t.name, name) === "same")) return true;
  const rows = (await execSql(
    `SELECT 'team' AS "kind" FROM "team" WHERE ("key" = ? OR "slug" = ?) AND "id" != ?
     UNION ALL SELECT 'hold' FROM "teamNameHold" WHERE ("key" = ? OR "slug" = ?) AND "userId" != ? AND "until" > ?
     UNION ALL SELECT 'server' FROM "server" WHERE "ownerId" != ? AND (lower("name") = lower(?) OR "slug" = ?)
     LIMIT 3`,
    [key, slug, exceptTeamId ?? "", key, slug, userId, now, userId, name, slug],
  )) as { kind: string }[];
  // L'admin peut poser un nom reserve (ou celui d'un serveur), jamais voler celui d'une autre team.
  return isAdmin ? rows.some((r) => r.kind === "team") : rows.length > 0;
}

// Cree (teamId null) ou modifie une team. Tout est revérifie ici (le formulaire n'est pas cru) :
// proprietaire, nombre de teams (3 sans demande, plus seulement par une demande acceptee : option
// `allowExtra`), nom (longueur, caracteres, mots interdits, noms reserves sauf pour l'admin,
// unicite, noms bloques), un changement de nom tous les 30 jours (sauf admin), description, et
// icone (seulement une image deposee sur ce site via /api/upload).
export async function saveTeam(
  userId: string,
  teamId: string | null,
  input: TeamSaveInput,
  opts: { host: string | null; isAdmin?: boolean; allowExtra?: boolean },
): Promise<{ error: TeamSaveError } | { id: string; slug: string }> {
  if (!TEAMS_READY) return { error: "generic" };
  const isAdmin = !!opts.isAdmin;
  const name = cleanTeamName(input.name);
  const description = cleanTeamDescription(input.description);

  type Current = { id: string; name: string; slug: string; key: string; iconUrl: string | null; renamedAt: string | null };
  let current: Current | null = null;
  if (teamId) {
    const [row] = (await execSql('SELECT "id", "name", "slug", "key", "iconUrl", "renamedAt" FROM "team" WHERE "id" = ? AND "ownerId" = ?', [
      teamId,
      userId,
    ])) as Current[];
    if (!row) return { error: "generic" };
    current = row;
  } else if (!isAdmin && !opts.allowExtra) {
    const [{ n }] = (await execSql('SELECT count(*) AS "n" FROM "team" WHERE "ownerId" = ?', [userId])) as { n: number }[];
    if (n >= TEAM_FREE_COUNT) return { error: "teamLimit" };
  }

  const key = teamKey(name);
  // Un nom reserve pose par l'admin (team Omniscient) reste modifiable par le compte (icone,
  // description) tant que le nom lui-meme ne change pas.
  const nameError = teamNameError(name, isAdmin || key === current?.key);
  if (nameError) return { error: nameError };
  const descriptionError = teamDescriptionError(description);
  if (descriptionError) return { error: descriptionError };

  const slug = teamSlug(name);
  const renamed = !!current && current.key !== key;
  if (renamed && !isAdmin && renameAllowedAt(current!.renamedAt)) return { error: "renameTooSoon" };
  if ((key !== current?.key || slug !== current?.slug) && (await nameTaken(key, slug, name, userId, teamId, isAdmin))) return { error: "nameTaken" };

  const iconUrl = input.iconUrl?.trim() || null;
  if (!isOwnImageUrl(iconUrl, opts.host, current?.iconUrl)) return { error: "icon" };
  if (iconUrl && iconUrl !== current?.iconUrl) {
    if (await imagesUsedByAnotherOwner([iconUrl], userId)) return { error: "icon" };
    const usedByTeam = await execSql('SELECT 1 AS "x" FROM "team" WHERE "ownerId" != ? AND instr(coalesce("iconUrl", \'\'), ?) > 0 LIMIT 1', [
      userId,
      imageKeyFromUrl(iconUrl) ?? iconUrl,
    ]);
    if (usedByTeam.length) return { error: "icon" };
  }

  const id = current?.id ?? crypto.randomUUID();
  try {
    if (current) {
      await execSql(
        `UPDATE "team" SET "name" = ?, "slug" = ?, "key" = ?, "iconUrl" = ?, "description" = ?,
           "renamedAt" = CASE WHEN ? THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE "renamedAt" END,
           "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE "id" = ?`,
        [name, slug, key, iconUrl, description || null, renamed ? 1 : 0, id],
      );
    } else {
      await execSql('INSERT INTO "team" ("id", "ownerId", "name", "slug", "key", "iconUrl", "description") VALUES (?, ?, ?, ?, ?, ?, ?)', [
        id,
        userId,
        name,
        slug,
        key,
        iconUrl,
        description || null,
      ]);
    }
  } catch {
    // Index unique : une autre team a pris ce nom entre la verification et l'ecriture.
    return { error: "nameTaken" };
  }

  // Ancien nom bloque 30 jours (et son lien redirige vers la team) ; reprendre son propre ancien
  // nom est permis.
  if (renamed && current) await holdName(userId, id, current.key, current.slug);
  await execSql('DELETE FROM "teamNameHold" WHERE "userId" = ? AND ("key" = ? OR "slug" = ?)', [userId, key, slug]);

  if (current?.iconUrl && current.iconUrl !== iconUrl) await deleteR2ImageIfOwned(current.iconUrl, null);
  return { id, slug };
}

async function holdName(userId: string, teamId: string | null, key: string, slug: string): Promise<void> {
  const until = new Date(Date.now() + TEAM_HOLD_DAYS * 86_400_000).toISOString();
  await execSql('INSERT OR REPLACE INTO "teamNameHold" ("key", "slug", "userId", "teamId", "until") VALUES (?, ?, ?, ?, ?)', [
    key,
    slug,
    userId,
    teamId,
    until,
  ]);
}

// Supprime une team : ses serveurs restent en ligne, sans team (server.teamId remis a null). Le
// nom reste bloque 30 jours pour que personne ne le reprenne aussitot pour se faire passer pour
// elle.
export async function deleteTeam(userId: string, teamId: string): Promise<void> {
  if (!TEAMS_READY) return;
  const [current] = (await execSql('SELECT "key", "slug", "iconUrl" FROM "team" WHERE "id" = ? AND "ownerId" = ?', [teamId, userId])) as {
    key: string;
    slug: string;
    iconUrl: string | null;
  }[];
  if (!current) return;
  // Pas de transaction avec l'API REST de D1 : serveurs d'abord (une team supprimee ne doit plus
  // s'afficher nulle part), puis la team elle-meme.
  await execSql('UPDATE "server" SET "teamId" = NULL WHERE "teamId" = ?', [teamId]);
  await execSql('DELETE FROM "team" WHERE "id" = ?', [teamId]);
  await holdName(userId, null, current.key, current.slug);
  if (current.iconUrl) await deleteR2ImageIfOwned(current.iconUrl, null);
}

// Interrupteur de « Ma team », liste « Team » de Paramètres : met un serveur du compte dans une
// de ses teams, ou dans aucune (teamId null). Les deux appartenances sont verifiees dans la
// requete elle-meme (un seul appel).
export async function setServerTeam(userId: string, serverId: string, teamId: string | null): Promise<boolean> {
  if (!TEAMS_READY) return false;
  const rows = teamId
    ? await execSql(
        `UPDATE "server" SET "teamId" = ?, "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE "id" = ? AND "ownerId" = ? AND EXISTS (SELECT 1 FROM "team" WHERE "id" = ? AND "ownerId" = ?) RETURNING "id"`,
        [teamId, serverId, userId, teamId, userId],
      )
    : await execSql(
        `UPDATE "server" SET "teamId" = NULL, "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = ? AND "ownerId" = ? RETURNING "id"`,
        [serverId, userId],
      );
  return rows.length > 0;
}

// A la creation d'un serveur : la team choisie, si elle est bien a ce compte, sinon aucune.
export async function ownTeamIdOrNull(userId: string, teamId: string | null): Promise<string | null> {
  if (!TEAMS_READY || !teamId) return null;
  const rows = await execSql('SELECT "id" FROM "team" WHERE "id" = ? AND "ownerId" = ?', [teamId, userId]);
  return rows.length ? teamId : null;
}

// Admin (fiche joueur) : retirer seulement l'icone ou la description d'une team.
export async function clearTeamField(teamId: string, field: "icon" | "description"): Promise<void> {
  if (!TEAMS_READY) return;
  if (field === "description") {
    await execSql('UPDATE "team" SET "description" = NULL WHERE "id" = ?', [teamId]);
    return;
  }
  const [row] = (await execSql('SELECT "iconUrl" FROM "team" WHERE "id" = ?', [teamId])) as { iconUrl: string | null }[];
  await execSql('UPDATE "team" SET "iconUrl" = NULL WHERE "id" = ?', [teamId]);
  if (row?.iconUrl) await deleteR2ImageIfOwned(row.iconUrl, null);
}

// ---- Demandes de team (une team de plus, avec une preuve) ----

export type TeamRequestSubmitError = TeamRequestError | "freeSlotLeft" | "alreadyPending" | "nameTaken" | "proofImage" | "generic";

export async function submitTeamRequest(
  userId: string,
  input: { name: string; reason: string; proof: string; proofImageUrl: string | null },
  host: string | null,
): Promise<{ error: TeamRequestSubmitError } | { ok: true }> {
  if (!TEAMS_READY) return { error: "generic" };
  const clean = {
    name: cleanTeamName(input.name),
    reason: cleanTeamDescription(input.reason),
    proof: cleanTeamDescription(input.proof),
    proofImageUrl: input.proofImageUrl?.trim() || null,
  };
  const error = teamRequestError(clean);
  if (error) return { error };
  if (!isOwnImageUrl(clean.proofImageUrl, host)) return { error: "proofImage" };

  const [state] = (await execSql(
    `SELECT (SELECT count(*) FROM "team" WHERE "ownerId" = ?) AS "teams",
            (SELECT count(*) FROM "teamRequest" WHERE "userId" = ? AND "status" = 'pending') AS "pending"`,
    [userId, userId],
  )) as { teams: number; pending: number }[];
  // Les 3 premieres teams se creent directement ; la demande sert seulement a en avoir une de plus.
  if (state.teams < TEAM_FREE_COUNT) return { error: "freeSlotLeft" };
  if (state.pending) return { error: "alreadyPending" };
  if (await nameTaken(teamKey(clean.name), teamSlug(clean.name), clean.name, userId, null, false)) return { error: "nameTaken" };

  await execSql('INSERT INTO "teamRequest" ("id", "userId", "name", "reason", "proof", "proofImageUrl") VALUES (?, ?, ?, ?, ?, ?)', [
    crypto.randomUUID(),
    userId,
    clean.name,
    clean.reason,
    clean.proof,
    clean.proofImageUrl,
  ]);
  return { ok: true };
}

// ---- Page admin « Teams » (20/10) : toutes les teams, noms suspects en premier ----

export type AdminTeam = {
  id: string;
  ownerId: string;
  ownerName: string | null;
  name: string;
  slug: string;
  iconUrl: string | null;
  description: string | null;
  createdAt: string;
  serverCount: number;
  official: boolean;
  // Nom reserve imite (« Omniscient ») ou team d'un autre compte au nom trop proche, sinon null.
  // Calcule a l'affichage : rien n'est enregistre en base.
  looksLike: { name: string; kind: "reserved" | "same" | "close" } | null;
};

export async function listAllTeams(): Promise<AdminTeam[]> {
  if (!TEAMS_READY) return [];
  const rows = (await execSql(
    `SELECT t."id", t."ownerId", u."name" AS "ownerName", t."name", t."slug", t."iconUrl", t."description", t."createdAt",
            (SELECT count(*) FROM "server" s WHERE s."teamId" = t."id" AND s."ownerId" = t."ownerId") AS "serverCount"
     FROM "team" t LEFT JOIN "user" u ON u."id" = t."ownerId" ORDER BY t."createdAt" DESC`,
    [],
  )) as Omit<AdminTeam, "official" | "looksLike">[];
  const teams = rows.map((t) => ({ ...t, official: t.slug === OFFICIAL_TEAM_SLUG }));
  return teams.map((t) => {
    let looksLike: AdminTeam["looksLike"] = null;
    if (!t.official) {
      const reserved = reservedNameImitated(t.name);
      if (reserved) looksLike = { name: reserved, kind: "reserved" };
      else {
        // La plus ancienne des deux est l'originale : seule la plus recente est signalee.
        for (const other of teams) {
          if (other.ownerId === t.ownerId || other.createdAt > t.createdAt || other.id === t.id) continue;
          const clash = teamNamesClash(other.name, t.name);
          if (clash) {
            looksLike = { name: other.name, kind: clash };
            if (clash === "same") break;
          }
        }
      }
    }
    return { ...t, looksLike };
  });
}

export type AdminTeamRequest = {
  id: string;
  userId: string;
  userName: string | null;
  teamCount: number;
  name: string;
  reason: string;
  proof: string;
  proofImageUrl: string | null;
  status: "pending" | "accepted" | "refused";
  refuseReason: string | null;
  createdAt: string;
  decidedAt: string | null;
};

// Page admin « Demandes de team » : en attente d'abord (plus anciennes en premier), puis les 30
// dernieres decisions.
export async function listTeamRequests(): Promise<AdminTeamRequest[]> {
  if (!TEAMS_READY) return [];
  return (await execSql(
    `SELECT r."id", r."userId", u."name" AS "userName", (SELECT count(*) FROM "team" t WHERE t."ownerId" = r."userId") AS "teamCount",
            r."name", r."reason", r."proof", r."proofImageUrl", r."status", r."refuseReason", r."createdAt", r."decidedAt"
     FROM "teamRequest" r LEFT JOIN "user" u ON u."id" = r."userId"
     WHERE r."status" = 'pending' OR r."id" IN (SELECT "id" FROM "teamRequest" WHERE "status" != 'pending' ORDER BY "decidedAt" DESC LIMIT 30)
     ORDER BY CASE r."status" WHEN 'pending' THEN 0 ELSE 1 END, CASE r."status" WHEN 'pending' THEN r."createdAt" END, r."decidedAt" DESC`,
    [],
  )) as AdminTeamRequest[];
}

export async function countPendingTeamRequests(): Promise<number> {
  if (!TEAMS_READY) return 0;
  const [row] = (await execSql(`SELECT count(*) AS "n" FROM "teamRequest" WHERE "status" = 'pending'`, [])) as { n: number }[];
  return row?.n ?? 0;
}

async function notifyUser(userId: string, teamName: string, message: string): Promise<void> {
  const [user] = (await execSql('SELECT "minecraftUuid" FROM "user" WHERE "id" = ?', [userId])) as { minecraftUuid: string | null }[];
  if (!user?.minecraftUuid) return;
  try {
    await createNotification({ recipientMinecraftUuid: user.minecraftUuid, type: "admin_info", serverName: teamName, message });
  } catch (error) {
    // Pas bloquant : la decision est enregistree, le joueur la voit aussi dans « Ma team ».
    console.error("[teams] Notification de demande de team impossible", error);
  }
}

// Accepter : la team est creee au nom demande (memes controles qu'une team, unicite comprise),
// puis le joueur est prevenu. Refuser : motif obligatoire, montre au joueur.
export async function acceptTeamRequest(requestId: string, adminName: string): Promise<{ error: string } | { ok: true }> {
  const [req] = (await execSql(`SELECT "userId", "name" FROM "teamRequest" WHERE "id" = ? AND "status" = 'pending'`, [requestId])) as {
    userId: string;
    name: string;
  }[];
  if (!req) return { error: "Demande introuvable ou déjà traitée." };
  const result = await saveTeam(req.userId, null, { name: req.name, description: "", iconUrl: null }, { host: null, allowExtra: true });
  if ("error" in result) return { error: result.error === "nameTaken" ? "Ce nom est déjà pris : refuse la demande avec ce motif." : "Le nom demandé n'est pas valide." };
  await execSql(
    `UPDATE "teamRequest" SET "status" = 'accepted', "teamId" = ?, "decidedBy" = ?, "decidedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = ?`,
    [result.id, adminName, requestId],
  );
  await notifyUser(req.userId, req.name, "Ta demande de team est acceptée : elle est dans « Ma team », tu peux y mettre tes serveurs.");
  return { ok: true };
}

export async function refuseTeamRequest(requestId: string, adminName: string, reason: string): Promise<{ error: string } | { ok: true }> {
  const motive = cleanTeamDescription(reason).slice(0, 300);
  if (!motive) return { error: "Indique le motif du refus." };
  const rows = (await execSql(
    `UPDATE "teamRequest" SET "status" = 'refused', "refuseReason" = ?, "decidedBy" = ?, "decidedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE "id" = ? AND "status" = 'pending' RETURNING "userId", "name"`,
    [motive, adminName, requestId],
  )) as { userId: string; name: string }[];
  if (!rows[0]) return { error: "Demande introuvable ou déjà traitée." };
  await notifyUser(rows[0].userId, rows[0].name, `Ta demande de team est refusée : ${motive}`);
  return { ok: true };
}

// Page /team/<slug> : la team, ou le lien actuel si c'est un ancien nom encore bloque. Un appel,
// garde en cache 5 minutes (et vide par les actions d'enregistrement : SERVERS_CACHE_TAG).
export type TeamLookup = { team: TeamBadge & { ownerId: string } } | { redirectTo: string } | null;

export const findTeamBySlug = unstable_cache(
  async (slug: string): Promise<TeamLookup> => {
    if (!TEAMS_READY) return null;
    const rows = (await execSql(
      `SELECT t."id", t."ownerId", t."name", t."slug", t."iconUrl", t."description", 0 AS "held" FROM "team" t WHERE t."slug" = ?
       UNION ALL
       SELECT t."id", t."ownerId", t."name", t."slug", t."iconUrl", t."description", 1 FROM "teamNameHold" h JOIN "team" t ON t."id" = h."teamId"
         WHERE h."slug" = ? AND h."until" > ?
       LIMIT 1`,
      [slug, slug, new Date().toISOString()],
    )) as (TeamRow & { id: string; ownerId: string; held: number })[];
    const row = rows[0];
    const b = row ? badge(row.id, row) : null;
    if (!row || !b) return null;
    if (row.held) return { redirectTo: b.slug };
    return { team: { ...b, ownerId: row.ownerId } };
  },
  ["team-by-slug-v2"],
  // "servers" = SERVERS_CACHE_TAG (pas importe : public-servers.ts importe deja ce fichier).
  { revalidate: 300, tags: ["servers"] },
);
