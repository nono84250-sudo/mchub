import { timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { MANUAL_MODS_COLUMNS } from "@/lib/manualMods";
import { db, execBatch, execSql } from "@/lib/db";
import { getServerStatus, scheduleStatusRefresh } from "@/lib/server-status";
import { LAUNCHER_SESSION_HEADER, normalizeMinecraftUuid, sessionIdentity, verifyMinecraftIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { isValidLink, parsePageConfig, type PageLanguage, type PageTag, type ServerPageConfig } from "@/lib/serverPage";
import {
  DEFAULT_FILTERS,
  blockingFilter,
  computeFacets,
  filterServers,
  isNewServer,
  sortServers,
  trendScore,
  type FilterKey,
  type ServerFacets,
  type ServerListFilters,
} from "@/lib/serverFilters";
import { getTagCatalog } from "@/lib/tagRequests";
import { tagsMatchingQuery } from "@/lib/tagCatalog";
import { TEAM_COLUMNS, teamBadgeFor } from "@/lib/teams";
import { TEAMS_READY } from "@/lib/teamRules";
import { FIXED_SERVER_INFO_SECONDS, LIVE_STATUS_SECONDS, OWNED_SERVERS_SECONDS } from "@/lib/refreshSettings";
import { parseModpackSource, type ModpackSource } from "@/lib/modpack-types";
import type { TeamBadge } from "@/lib/teamRules";

// Teams (19/10) : la team choisie par chaque serveur (server.teamId). ownerId sert a ne pas
// afficher la team d'un autre compte sur un serveur transfere (lib/teams.ts, teamBadgeFor).
const TEAM_SERVER_COLUMNS = TEAMS_READY ? (["ownerId", "teamId"] as const) : ([] as const);

// Etiquette du cache des infos FIXES des serveurs (nom, description, images, etiquettes, team...) :
// toute ecriture qui change une fiche ou sa visibilite (proprietaire, admin, gel, pause, validation,
// team, suppression de compte...) l'invalide avec updateTag/revalidateTag(SERVERS_CACHE_TAG), donc
// le changement est visible tout de suite. Sans changement, ces infos ne sont relues qu'au bout de
// FIXED_SERVER_INFO_SECONDS (1 h, securite seulement ; voir lib/refreshSettings.ts).
export const SERVERS_CACHE_TAG = "servers";
// 21/10 : infos VIVANTES (joueurs, capacite, derniere mesure), lues a part en UNE requete pour
// tous les serveurs et gardees LIVE_STATUS_SECONDS (5 min). La tache automatique qui mesure les
// serveurs (/api/cron/recheck-reachability) ne vide plus que cette etiquette : avant, elle vidait
// tout le cache des fiches toutes les 5 min. L'entree porte AUSSI SERVERS_CACHE_TAG : une fiche
// modifiee (nouvelle IP, serveur tout juste valide) relit donc aussi les chiffres tout de suite.
export const SERVERS_LIVE_CACHE_TAG = "servers-live";

// Lecture SQL directe des serveurs avec leur proprietaire et leur team en UNE requete (JOIN) :
// .include("owner") et .include("team") de lib/db.ts faisaient chacun un appel D1 de plus.
// Rend exactement la meme forme qu'avant : `owner` = { minecraftUuid } ou null, `team` = les
// colonnes TEAM_COLUMNS ou null, booleens en true/false.
const SERVER_BOOLEAN_COLUMNS = ["published", "isPrivate", "autoConnect", "addToServerList"];
// Meme type libre que les lignes de lib/db.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerRow = any;
async function selectServersWithOwnerAndTeam(columns: readonly string[], whereSql: string, params: unknown[], tail = ""): Promise<ServerRow[]> {
  const list = [...new Set(columns)].map((c) => `s."${c}"`).join(", ");
  const teamSelect = TEAMS_READY ? `, t."id" AS "__teamId", ${TEAM_COLUMNS.map((c) => `t."${c}" AS "__team_${c}"`).join(", ")}` : "";
  const teamJoin = TEAMS_READY ? ` LEFT JOIN "team" t ON t."id" = s."teamId"` : "";
  const rows = (await execSql(
    `SELECT ${list}, u."id" AS "__ownerId", u."minecraftUuid" AS "__ownerUuid"${teamSelect} FROM "server" s LEFT JOIN "user" u ON u."id" = s."ownerId"${teamJoin} WHERE ${whereSql}${tail}`,
    params,
  )) as ServerRow[];
  return rows.map((row: ServerRow) => {
    for (const c of SERVER_BOOLEAN_COLUMNS) if (c in row && row[c] !== null) row[c] = !!row[c];
    row.owner = row.__ownerId ? { minecraftUuid: row.__ownerUuid ?? null } : null;
    delete row.__ownerId;
    delete row.__ownerUuid;
    if (TEAMS_READY) {
      row.team = row.__teamId ? Object.fromEntries(TEAM_COLUMNS.map((c) => [c, row[`__team_${c}`] ?? null])) : null;
      delete row.__teamId;
      for (const c of TEAM_COLUMNS) delete row[`__team_${c}`];
    }
    return row;
  });
}

export type LiveStatus = { playerCount: number | null; playerCapacity: number | null; lastPingedAt: string | null };
const NO_LIVE_STATUS: LiveStatus = { playerCount: null, playerCapacity: null, lastPingedAt: null };

// Joueurs en ligne de tous les serveurs publies et valides, prives compris (leur fiche reste
// visible avec un code d'invitation) : jamais renvoye tel quel, seulement fusionne avec une fiche
// que l'appelant a le droit de voir (canSeeServer). UN appel D1 au plus toutes les 5 min.
const loadLiveStatus = unstable_cache(
  async (): Promise<Record<string, LiveStatus>> => {
    const rows = (await execSql(
      `SELECT "id", "playerCount", "playerCapacity", "lastPingedAt" FROM "server" WHERE "published" = 1 AND "verificationStatus" = 'approved'`,
    )) as unknown as ({ id: string } & LiveStatus)[];
    return Object.fromEntries(rows.map((r) => [r.id, { playerCount: r.playerCount ?? null, playerCapacity: r.playerCapacity ?? null, lastPingedAt: r.lastPingedAt ?? null }]));
  },
  ["servers-live-status-v1"],
  { revalidate: LIVE_STATUS_SECONDS, tags: [SERVERS_LIVE_CACHE_TAG, SERVERS_CACHE_TAG] },
);

function liveFor(id: string, live: Record<string, LiveStatus>): LiveStatus {
  return live[id] ?? NO_LIVE_STATUS;
}

// Annuaire : nombre de serveurs par page.
export const SERVERS_PAGE_SIZE = 24;

// Point d'accès unique aux données "publiques" d'un serveur (annuaire du
// site ET API publique consommée par le launcher, cf. section 3 du cahier
// des charges — "modèle de synchronisation"). `ip` est toujours lue en
// base pour permettre le ping, mais n'est jamais incluse dans les types
// retournés ici : c'est la seule garantie qu'elle ne peut pas fuiter par
// erreur vers une page ou une réponse API publique.

export type PublicServerBase = {
  slug: string;
  name: string;
  description: string;
  bannerUrl: string | null;
  iconUrl: string | null;
  type: "vanilla" | "modded";
  playerCount: number | null;
  playerCapacity: number | null;
  // Vrai une fois le serveur contacté : sans réponse (playerCount null), il est « fermé ».
  pinged: boolean;
  createdAt: string;
  viewCount: number;
  // UUID Minecraft du proprietaire (toujours renseigne desormais : voir
  // auth.ts, la connexion se fait uniquement via Microsoft/Xbox) — permet au
  // launcher d'afficher un badge "Owner" sur ses propres serveurs dans
  // l'annuaire, en comparant a son propre profil deja connu localement
  // (aucune donnee de session ne remonte au site).
  ownerMinecraftUuid: string | null;
  // Teams (19/10) : « Par la team X » / « Proposé par Omniscient », null sans team. Champ AJOUTE
  // seulement (un ancien launcher l'ignore). Lu avec le proprietaire : 0 appel D1 en plus.
  team: TeamBadge | null;
};

export type PublicServerSummary = PublicServerBase & {
  // Filtres de l'annuaire (2026-10-16) : champs AJOUTES seulement, un ancien launcher les ignore.
  minecraftVersion: string;
  modpackName: string | null;
  recommendedRamGB: number | null;
  tags: PageTag[];
  // Cartes en lignes (19/10, variante A) : les 3 principales, a part des supplementaires.
  mainTags: PageTag[];
  languages: PageLanguage[];
  launchCount: number;
  selfTestPassedAt: string | null;
  // Lot 5 (18/10) : mods a ajouter a la main par le joueur (badge bleu). Champ AJOUTE seulement.
  manualModsCount: number;
  isNew: boolean;
  // Score « Tendance » deja calcule (meme formule pour le site et le launcher, voir serverFilters.ts).
  trendScore: number;
};

export type ListPublicServersOptions = Partial<ServerListFilters>;

export type PublicServerDetail = PublicServerBase & {
  minecraftVersion: string;
  curseforgeModpackId: string | null;
  // Source du modpack (21/10) : la fiche affiche « Source : FTB » et le lien vers le pack.
  modpackSource: ModpackSource;
  curseforgeModpackName: string | null;
  curseforgeModpackVersion: string | null;
  recommendedRamGB: number | null;
  backgroundUrl: string | null;
  // Badge de fraicheur (voir lib/freshness.ts) : date du dernier auto-test de publication
  // reussi depuis le launcher, jamais null->"jamais teste" pour une fiche deja approuvee avant
  // l'existence de ce controle (voir le commentaire sur selfTestPassedAt dans schema.sql).
  selfTestPassedAt: string | null;
  manualModsCount: number;
  // Liste Multijoueur (21/10) : false = le launcher affiche une ligne sous Jouer (pas sensible,
  // ce n'est qu'un reglage ; l'IP reste reservee a /api/launcher/servers/[slug]).
  addToServerList: boolean;
  // Meme usage que LauncherServerDetail.isPrivate (presence Discord du launcher).
  isPrivate: boolean;
  // Fiche personnalisable (voir lib/serverPage.ts) : deja nettoyee, prete a afficher.
  page: ServerPageConfig;
  discordUrl: string | null;
  websiteUrl: string | null;
};

// Filtre et tri faits en JS plutot que dans la requete : a l'echelle d'un
// annuaire perso (quelques dizaines de serveurs), c'est largement suffisant
// et evite d'apprendre la syntaxe "contains" du lane ORM Prisma 8 pour un
// gain de performance qui ne se verrait pas ici (meme raisonnement que le
// bucketing de la page Activite, voir server-activity.ts).
// Tous les serveurs publies et publics (infos FIXES), lus en base au plus une fois par heure
// (et des qu'une fiche change : SERVERS_CACHE_TAG). Contient `id` et `ip` pour la mesure des
// joueurs en ligne — cote serveur uniquement : jamais renvoyes par les fonctions publiques
// ci-dessous. Les joueurs en ligne viennent de loadLiveStatus (voir loadPublishedServersLive).
// Limite : le cache de donnees de Vercel accepte 2 Mo par entree, soit environ 3 000 serveurs ;
// au-dela il faudra paginer dans la requete SQL.
// Filtres (2026-10-16) : minecraftVersion, modpack, RAM, lancements, auto-test et pageConfig
// sont lus dans la MEME requete (aucun appel en plus). pageConfig est reduit ici a ses
// etiquettes et langues AVANT la mise en cache, pour ne pas stocker les textes et liens de
// chaque fiche dans l'entree de 2 Mo.
const loadPublishedServers = unstable_cache(
  async () => {
    const rows = await selectServersWithOwnerAndTeam(
      [
        "id",
        "slug",
        "name",
        "description",
        "bannerUrl",
        "iconUrl",
        "type",
        "ip",
        "createdAt",
        "viewCount",
        "minecraftVersion",
        "curseforgeModpackName",
        "recommendedRamGB",
        "launchCount",
        "selfTestPassedAt",
        "pageConfig",
        ...MANUAL_MODS_COLUMNS,
        ...TEAM_SERVER_COLUMNS,
      ],
      `s."published" = 1 AND s."isPrivate" = 0 AND s."verificationStatus" = 'approved'`,
      [],
      ` ORDER BY s."createdAt" DESC`,
    );
    return rows.map(({ pageConfig, ...row }) => {
      const page = parsePageConfig(pageConfig);
      // Principales d'abord, puis les supplementaires (config.extraTags, fil « Fiche serveur ») :
      // le filtre et la recherche voient les deux, la carte montre les premieres.
      const extra = (page as { extraTags?: PageTag[] }).extraTags ?? [];
      return { ...row, tags: [...new Set([...page.tags, ...extra])], mainTags: page.tags, languages: page.languages };
    });
  },
  ["published-servers-fixed-v6"],
  { revalidate: FIXED_SERVER_INFO_SECONDS, tags: [SERVERS_CACHE_TAG] },
);

// Infos fixes + joueurs en ligne, fusionnes a la lecture (deux entrees de cache, 0 appel D1
// quand les deux sont a jour).
async function loadPublishedServersLive() {
  const [rows, live] = await Promise.all([loadPublishedServers(), loadLiveStatus()]);
  return rows.map((row) => ({ ...row, ...liveFor(row.id, live) }));
}

type PublishedServerRow = Awaited<ReturnType<typeof loadPublishedServersLive>>[number];

// Forme attendue par les filtres (serverFilters.ts), sans rien recalculer a chaque appel.
function asFilterable(row: PublishedServerRow) {
  return {
    row,
    name: row.name,
    description: row.description,
    type: row.type,
    minecraftVersion: row.minecraftVersion ?? "",
    modpackName: row.type === "modded" ? row.curseforgeModpackName ?? null : null,
    tags: row.tags,
    mainTags: row.mainTags,
    languages: row.languages,
    playerCount: row.playerCount,
    playerCapacity: row.playerCapacity,
    pinged: row.lastPingedAt != null,
    createdAt: row.createdAt,
    launchCount: row.launchCount ?? 0,
    selfTestPassedAt: row.selfTestPassedAt ?? null,
    manualModsCount: (row as { manualModsCount?: number }).manualModsCount ?? 0,
    team: (() => {
      const badge = teamBadgeFor(row);
      return badge ? { slug: badge.slug, name: badge.name, iconUrl: badge.iconUrl } : null;
    })(),
  };
}

// Recherche : un mot qui est le nom (FR/EN) ou un alias d'une etiquette trouve aussi les serveurs
// qui la portent (demandes d'etiquettes, 16/10). La liste des etiquettes est en cache comme
// celle des serveurs (getTagCatalog) : aucun appel D1 de plus par recherche.
async function filterAndSort(rows: PublishedServerRow[], options: ListPublicServersOptions) {
  const filters: ServerListFilters = { ...DEFAULT_FILTERS, ...options };
  const all = rows.map(asFilterable);
  const qTags = filters.q.trim() ? tagsMatchingQuery(filters.q, await getTagCatalog()) : [];
  return { all, filters, qTags, sorted: sortServers(filterServers(all, filters, qTags), filters.sort, Date.now(), filters.order) };
}

function toSummary(item: ReturnType<typeof asFilterable>, now = Date.now()): PublicServerSummary {
  const row = item.row;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerUrl: row.bannerUrl,
    iconUrl: row.iconUrl,
    type: row.type,
    playerCount: row.playerCount,
    playerCapacity: row.playerCapacity,
    pinged: row.lastPingedAt != null,
    createdAt: row.createdAt,
    viewCount: row.viewCount,
    ownerMinecraftUuid: row.owner?.minecraftUuid ?? null,
    team: teamBadgeFor(row),
    minecraftVersion: item.minecraftVersion,
    modpackName: item.modpackName,
    recommendedRamGB: row.recommendedRamGB ?? null,
    tags: item.tags,
    mainTags: item.mainTags,
    languages: item.languages,
    launchCount: item.launchCount,
    selfTestPassedAt: item.selfTestPassedAt,
    manualModsCount: item.manualModsCount,
    isNew: isNewServer(row.createdAt, now),
    trendScore: Math.round(trendScore(item, now) * 1000) / 1000,
  };
}

// Liste complete (API publique consommee par le launcher, qui filtre de son cote).
export async function listPublicServers(options: ListPublicServersOptions = {}): Promise<PublicServerSummary[]> {
  const { sorted } = await filterAndSort(await loadPublishedServersLive(), options);

  // L'affichage montre le dernier chiffre enregistré ; les statuts périmés sont
  // re-mesurés après l'envoi de la page (voir server-status.ts).
  scheduleStatusRefresh(sorted.map((s) => s.row));
  const now = Date.now();
  return sorted.map((s) => toSummary(s, now));
}

export type PublicServersPage = {
  servers: PublicServerSummary[];
  total: number;
  // Taille de l'annuaire sans filtre (etat vide : « annuaire vide » ou « aucun resultat »).
  directoryTotal: number;
  page: number;
  pageCount: number;
  filters: ServerListFilters;
  facets: ServerFacets;
  blocking: { key: FilterKey; gain: number } | null;
  // Design 2026-10-17, point 5 : derniere mesure des joueurs parmi les serveurs affiches
  // (« Joueurs comptes il y a 2 min »), null si aucun n'a encore ete mesure.
  countedAt: string | null;
};

// Une page de l'annuaire (SERVERS_PAGE_SIZE serveurs) : evite d'envoyer et de
// construire des centaines de cartes a chaque visite. `page` est ramenee dans
// les bornes (une page trop grande donne la derniere).
export async function listPublicServersPage(options: ListPublicServersOptions & { page?: number }): Promise<PublicServersPage> {
  const { all, filters, qTags, sorted } = await filterAndSort(await loadPublishedServersLive(), options);
  const pageCount = Math.max(1, Math.ceil(sorted.length / SERVERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1) || 1), pageCount);
  const slice = sorted.slice((page - 1) * SERVERS_PAGE_SIZE, page * SERVERS_PAGE_SIZE);

  // Seuls les serveurs affiches sont re-mesures en priorite.
  scheduleStatusRefresh(slice.map((s) => s.row));
  const now = Date.now();
  return {
    servers: slice.map((s) => toSummary(s, now)),
    total: sorted.length,
    directoryTotal: all.length,
    page,
    pageCount,
    filters,
    facets: computeFacets(all, filters, qTags),
    blocking: sorted.length === 0 ? blockingFilter(all, filters, qTags) : null,
    countedAt: slice.reduce<string | null>((max, s) => {
      const at = s.row.lastPingedAt ? new Date(s.row.lastPingedAt).toISOString() : null;
      return at && (!max || at > max) ? at : max;
    }, null),
  };
}

export type LauncherServerDetail = {
  name: string;
  type: "vanilla" | "modded";
  ip: string;
  minecraftVersion: string;
  curseforgeModpackId: string | null;
  recommendedRamGB: number | null;
  autoConnect: boolean;
  // Liste Multijoueur (21/10) : false = ne pas ecrire l'adresse dans servers.dat (mcLaunch.js).
  addToServerList: boolean;
  // Serveur sur invitation : le launcher affiche alors « Joue sur un serveur prive » sur Discord,
  // sans le nom ni le modpack (voir launcher/src/discordPresence.js).
  isPrivate: boolean;
  // Lot 5 (18/10) : badge « X mods a ajouter » du launcher. Champ AJOUTE seulement.
  manualModsCount: number;
};

// Preuve qu'un visiteur a le droit de voir un serveur prive. Sans preuve, un
// serveur prive est traite comme inexistant : jamais de fiche, d'IP ni de
// modpack par simple slug (le slug se devine a partir du nom). Deux preuves
// valent, au choix : le code d'invitation (joueur qui a rejoint le serveur, ou
// page /join/[code]) ; le jeton Mojang du proprietaire (verifie aupres de Mojang).
export type PrivateServerProof = { inviteCode?: string | null; minecraftToken?: string | null; launcherSession?: string | null };

// Lit la preuve dans les en-tetes d'une requete API (envoyes par le launcher).
export function proofFromRequest(request: Request): PrivateServerProof {
  return {
    inviteCode: request.headers.get("x-invite-code"),
    minecraftToken: request.headers.get("x-minecraft-token"),
    launcherSession: request.headers.get(LAUNCHER_SESSION_HEADER),
  };
}

// Devinage de codes : une requete qui porte un code d'invitation compte dans
// une limite dediee (meme esprit que /join/[code]). Sans cela, les routes API
// acceptant le code seraient un moyen de le deviner plus vite que la page.
export function limitInviteAttempts(request: Request, headers?: Record<string, string>): NextResponse | null {
  if (!request.headers.get("x-invite-code")) return null;
  return rateLimitResponse(request, "invite-proof", 30, { headers });
}

function sameCode(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Le proprietaire prouve son identite (jeton de session, ou a defaut jeton Mojang) : utilise a
// la fois par canSeeServer (serveur prive) et par le contournement de la file de verification
// ci-dessous (le proprietaire doit toujours pouvoir lancer/tester SON propre serveur, approuve
// ou non — voir getServerWithIpBySlug).
export async function isProvenOwner(owner: { minecraftUuid: string | null } | null, proof: PrivateServerProof): Promise<boolean> {
  if (proof.launcherSession != null) {
    const uuid = await sessionIdentity(proof.launcherSession);
    return !!uuid && !!owner?.minecraftUuid && uuid === normalizeMinecraftUuid(owner.minecraftUuid);
  }
  return (await verifyMinecraftIdentity(proof.minecraftToken ?? null, owner?.minecraftUuid ?? null)) === "verified";
}

export async function canSeeServer(
  server: { isPrivate: boolean; inviteCode: string | null; owner: { minecraftUuid: string | null } | null },
  proof: PrivateServerProof,
): Promise<boolean> {
  if (!server.isPrivate) return true;
  const code = proof.inviteCode?.trim().toUpperCase();
  if (code && server.inviteCode && sameCode(code, server.inviteCode)) return true;
  return isProvenOwner(server.owner, proof);
}

export type VisibilityRow = {
  published: boolean;
  isPrivate: boolean;
  inviteCode: string | null;
  verificationStatus: "pending" | "approved" | "rejected";
  owner: { minecraftUuid: string | null } | null;
};

// Garde complet de visibilite d'un serveur (audit 2026-10-10 §1.3) : publie, ET soit approuve,
// soit prive avec preuve (code d'invitation/jeton), soit son proprietaire prouve — partage par
// getServerWithIpBySlug/visibleServerIdBySlug/checkSlugVisibility et la route modpack, pour que
// tous ces chemins appliquent exactement la meme regle qu'un serveur moddé public mais pas
// encore publie/valide ne fuite ni son IP, ni son modpack, ni un simple "ça existe".
export async function isVisibleRow(row: VisibilityRow, proof: PrivateServerProof): Promise<boolean> {
  if (!row.published) return false;
  if (!(await canSeeServer(row, proof))) return false;
  if (row.verificationStatus !== "approved" && !row.isPrivate && !(await isProvenOwner(row.owner, proof))) return false;
  return true;
}

// Audit de charge du 19/10 (B4) : la ligne du serveur ET le pseudo Minecraft du proprietaire en
// UNE requete (JOIN), au lieu de deux (.include("owner") fait un 2e appel a D1). « Rejoindre »
// relisait aussi la meme ligne deux fois (visibilite puis IP) : voir getLauncherServerForJoin.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function serverWithOwnerBySlug(slug: string, columns: readonly string[]): Promise<Record<string, any> | null> {
  const list = [...new Set(columns)].map((c) => `s."${c}"`).join(", ");
  const rows = (await execSql(
    `SELECT ${list}, u."minecraftUuid" AS "__ownerUuid", s."ownerId" AS "__ownerId" FROM "server" s LEFT JOIN "user" u ON u."id" = s."ownerId" WHERE s."slug" = ? LIMIT 1`,
    [slug],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as Record<string, any>[];
  const row = rows[0];
  if (!row) return null;
  for (const c of SERVER_BOOLEAN_COLUMNS) if (c in row && row[c] !== null) row[c] = !!row[c];
  row.owner = row.__ownerId ? { minecraftUuid: row.__ownerUuid ?? null } : null;
  delete row.__ownerUuid;
  delete row.__ownerId;
  return row;
}

const VISIBILITY_COLUMNS = ["published", "isPrivate", "inviteCode", "verificationStatus"] as const;

// Routes d'ecriture par slug (signalement, compteur de lancements) : un serveur
// prive, non publie ou pas encore valide sans la preuve renvoie null, comme un
// slug inconnu — sinon la reponse (200 ou 404) reveleraient qu'un serveur existe.
export async function visibleServerIdBySlug(slug: string, proof: PrivateServerProof): Promise<string | null> {
  const row = await serverWithOwnerBySlug(slug, ["id", ...VISIBILITY_COLUMNS]);
  if (!row || !(await isVisibleRow(row as VisibilityRow, proof))) return null;
  return row.id;
}

export type SlugVisibility = { visible: true; frozenAt: string | null } | { visible: false };

// Visibilite + etat "gele" d'un slug, sans aucune donnee sensible — utilise par les routes
// qui doivent repondre differemment pour un serveur gele (audit §1.4) SANS reveler qu'un
// serveur prive/non publie/non valide existe : le contrôle "gele" ne doit s'executer qu'APRES
// avoir confirme que l'appelant peut voir ce serveur, jamais avant.
export async function checkSlugVisibility(slug: string, proof: PrivateServerProof): Promise<SlugVisibility> {
  const row = await serverWithOwnerBySlug(slug, [...VISIBILITY_COLUMNS, "frozenAt"]);
  if (!row || !(await isVisibleRow(row as VisibilityRow, proof))) return { visible: false };
  return { visible: true, frozenAt: row.frozenAt };
}

const LAUNCHER_DETAIL_COLUMNS = [
  "name",
  "type",
  "ip",
  "minecraftVersion",
  "curseforgeModpackId",
  "recommendedRamGB",
  "autoConnect",
  "addToServerList",
  ...VISIBILITY_COLUMNS,
  ...MANUAL_MODS_COLUMNS,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function launcherDetail(row: Record<string, any>): LauncherServerDetail {
  return {
    name: row.name,
    type: row.type,
    ip: row.ip,
    minecraftVersion: row.minecraftVersion,
    curseforgeModpackId: row.curseforgeModpackId,
    recommendedRamGB: row.recommendedRamGB,
    autoConnect: row.autoConnect,
    addToServerList: row.addToServerList !== false,
    isPrivate: row.isPrivate,
    manualModsCount: row.manualModsCount ?? 0,
  };
}

// Seules fonctions du fichier qui renvoient `ip` — réservées à la route
// /api/launcher/servers/[slug], protégée par LAUNCHER_API_KEY. Ne jamais
// exposer ce résultat via une route publique.
// Pas encore valide par un admin : le proprietaire doit quand meme pouvoir lancer/tester SON
// propre serveur (sinon il ne peut jamais rien verifier avant publication — absurde), et un
// serveur prive reste joignable par ses invites (meme logique que canSeeServer ci-dessus,
// cercle deja ferme par le code). Seul un serveur public reste bloque pour tout le monde
// d'autre tant qu'il n'est pas approuve — c'est exactement ce que la file protege (voir
// isVisibleRow, meme regle partagee avec visibleServerIdBySlug/checkSlugVisibility/modpack).
export async function getServerWithIpBySlug(slug: string, proof: PrivateServerProof = {}): Promise<LauncherServerDetail | null> {
  const row = await serverWithOwnerBySlug(slug, LAUNCHER_DETAIL_COLUMNS);
  if (!row || !(await isVisibleRow(row as VisibilityRow, proof))) return null;
  return launcherDetail(row);
}

// « Rejoindre » : visibilite, gel et IP en une seule lecture (avant : 4 appels a D1). Meme ordre
// de controle que checkSlugVisibility puis getServerWithIpBySlug : la visibilite d'abord, le gel
// ensuite (audit §1.4), pour ne jamais reveler qu'un serveur prive gele existe.
export type LauncherJoin = { status: "notFound" } | { status: "frozen" } | { status: "ok"; server: LauncherServerDetail };
export async function getLauncherServerForJoin(slug: string, proof: PrivateServerProof): Promise<LauncherJoin> {
  const row = await serverWithOwnerBySlug(slug, [...LAUNCHER_DETAIL_COLUMNS, "frozenAt"]);
  if (!row || !(await isVisibleRow(row as VisibilityRow, proof))) return { status: "notFound" };
  if (row.frozenAt) return { status: "frozen" };
  return { status: "ok", server: launcherDetail(row) };
}

// Appelee depuis un composant client (voir ViewTracker) plutot que pendant
// le rendu de la page : la fiche est revalidee au plus toutes les 60s
// (ISR), donc incrementer ce compteur pendant le rendu sous-compterait
// enormement les vues reelles (une seule execution par fenetre de 60s, tous
// visiteurs confondus). Une seule instruction SQL atomique : le compteur est
// augmente dans la base (`viewCount + 1`), pas lu puis reecrit — avec la lecture
// puis l'ecriture, deux visites simultanees perdaient une vue — et l'evenement
// est enregistre dans la meme instruction (ni ligne orpheline, ni compteur sans evenement).
export async function recordServerView(slug: string): Promise<void> {
  await execBatch([
    { sql: 'UPDATE "server" SET "viewCount" = "viewCount" + 1 WHERE "slug" = ?', params: [slug] },
    { sql: "INSERT INTO \"serverEvent\" (\"id\", \"serverId\", \"kind\") SELECT ?, \"id\", 'view' FROM \"server\" WHERE \"slug\" = ?", params: [crypto.randomUUID(), slug] },
  ]);
}

// Appelee par le launcher (route /api/launcher/servers/[slug]/launch) a
// chaque lancement reussi — meme instruction atomique que recordServerView.
export async function recordServerLaunch(slug: string): Promise<void> {
  await execBatch([
    { sql: 'UPDATE "server" SET "launchCount" = "launchCount" + 1 WHERE "slug" = ?', params: [slug] },
    { sql: "INSERT INTO \"serverEvent\" (\"id\", \"serverId\", \"kind\") SELECT ?, \"id\", 'launch' FROM \"server\" WHERE \"slug\" = ?", params: [crypto.randomUUID(), slug] },
  ]);
}

// Fiche publique lue en cache, comme la liste (meme etiquette : voir SERVERS_CACHE_TAG).
// Le slug est un argument de la fonction, donc il fait partie de la cle du cache.
// Colonnes de la fiche, partagees par la lecture publique (en cache, infos FIXES seulement) et la
// lecture du proprietaire (sans cache, avec les chiffres de la ligne : voir getPublicServerBySlug).
const LIVE_COLUMNS = ["playerCount", "playerCapacity", "lastPingedAt"] as const;
const DETAIL_COLUMNS = [
    "id",
    "slug",
    "name",
    "description",
    "bannerUrl",
    "iconUrl",
    "backgroundUrl",
    "type",
    "minecraftVersion",
    "ip",
    "curseforgeModpackId",
    "curseforgeModpackName",
    "curseforgeModpackVersion",
    "modpackSource",
    "recommendedRamGB",
    "createdAt",
    "viewCount",
    "isPrivate",
    "inviteCode",
    "selfTestPassedAt",
    "addToServerList",
    "pageConfig",
    "discordUrl",
    "websiteUrl",
    "frozenAt",
    ...MANUAL_MODS_COLUMNS,
    ...TEAM_SERVER_COLUMNS,
];

const loadPublishedServerBySlug = unstable_cache(
  async (slug: string) =>
    (await selectServersWithOwnerAndTeam(DETAIL_COLUMNS, `s."slug" = ? AND s."published" = 1 AND s."verificationStatus" = 'approved'`, [slug], " LIMIT 1"))[0] ?? null,
  ["published-server-by-slug-fixed-v7"],
  { revalidate: FIXED_SERVER_INFO_SECONDS, tags: [SERVERS_CACHE_TAG] },
);

// Fiche en cache + joueurs en ligne (cache partage, voir loadLiveStatus).
async function loadPublishedServerBySlugLive(slug: string) {
  const row = await loadPublishedServerBySlug(slug);
  if (!row) return null;
  return { ...row, ...liveFor(row.id, await loadLiveStatus()) };
}

// 20/10 : chemin rapide de l'API publique (/api/public/servers/[slug]) : la fiche en cache est
// deja publiee ET validee, donc si elle n'est pas gelee et que l'appelant peut la voir
// (canSeeServer), elle est visible au sens de isVisibleRow — sans la lecture D1 de
// checkSlugVisibility (avant : 1 appel REST a chaque ouverture de fiche dans le launcher).
// null = « pas de reponse rapide » : la route refait alors le chemin complet (404, gel, etc.).
export async function getCachedVisibleServerBySlug(slug: string, proof: PrivateServerProof): Promise<PublicServerDetail | null> {
  const row = await loadPublishedServerBySlugLive(slug);
  if (!row || row.frozenAt || !(await canSeeServer(row as VisibilityRow, proof))) return null;
  return toPublicServerDetail(row);
}

// `proof` : sans preuve (site, annuaire), un serveur prive renvoie null.
export async function getPublicServerBySlug(slug: string, proof: PrivateServerProof = {}): Promise<PublicServerDetail | null> {
  let row = await loadPublishedServerBySlugLive(slug);
  // 19/10 : le PROPRIETAIRE prouve (session du launcher ou jeton Mojang) voit aussi sa fiche pas
  // encore validee, en pause ou privee (sinon la fiche etait vide dans son launcher). Relue sans
  // cache et sans le filtre « approved » ; un tiers sans preuve ne passe jamais par ici.
  if (!row && (proof.launcherSession || proof.minecraftToken)) {
    const own = (await selectServersWithOwnerAndTeam([...DETAIL_COLUMNS, ...LIVE_COLUMNS], `s."slug" = ?`, [slug], " LIMIT 1"))[0] ?? null;
    if (own && (await isProvenOwner(own.owner, proof))) row = own as typeof row;
  }
  if (!row || !(await canSeeServer(row as VisibilityRow, proof))) return null;
  return toPublicServerDetail(row);
}

type ServerDetailRow = NonNullable<Awaited<ReturnType<typeof loadPublishedServerBySlugLive>>>;

async function toPublicServerDetail(row: ServerDetailRow): Promise<PublicServerDetail> {
  const status = await getServerStatus(row.id, row.ip, row);

  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerUrl: row.bannerUrl,
    iconUrl: row.iconUrl,
    backgroundUrl: row.backgroundUrl,
    ownerMinecraftUuid: row.owner?.minecraftUuid ?? null,
    team: teamBadgeFor(row),
    type: row.type,
    minecraftVersion: row.minecraftVersion,
    // Non sensible (c'est juste l'identifiant d'un projet CurseForge public) —
    // ajoute le 2026-10-11 pour que le launcher puisse installer un modpack
    // sans compte connecte (bouton "Installer"), contrairement a l'IP du
    // serveur qui, elle, reste reservee a /api/launcher/servers/[slug].
    curseforgeModpackId: row.curseforgeModpackId,
    curseforgeModpackName: row.curseforgeModpackName,
    curseforgeModpackVersion: row.curseforgeModpackVersion,
    modpackSource: parseModpackSource(row.modpackSource),
    playerCount: status.playerCount,
    playerCapacity: status.playerCapacity,
    pinged: row.lastPingedAt != null,
    recommendedRamGB: row.recommendedRamGB,
    createdAt: row.createdAt,
    viewCount: row.viewCount,
    selfTestPassedAt: row.selfTestPassedAt,
    manualModsCount: row.manualModsCount ?? 0,
    addToServerList: row.addToServerList !== false,
    isPrivate: row.isPrivate,
    page: parsePageConfig(row.pageConfig),
    // Revérifiés a l'affichage : ces colonnes existaient avant l'editeur, sans controle.
    discordUrl: row.discordUrl && isValidLink("discord", row.discordUrl) ? row.discordUrl : null,
    websiteUrl: row.websiteUrl && isValidLink("website", row.websiteUrl) ? row.websiteUrl : null,
  };
}

export type OwnedServerSummary = {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  type: "vanilla" | "modded";
  minecraftVersion: string;
  ip: string;
  published: boolean;
  isPrivate: boolean;
  frozenAt: string | null;
  frozenReason: string | null;
  inviteCode: string | null;
  playerCount: number | null;
  playerCapacity: number | null;
  recommendedRamGB: number | null;
  verificationStatus: "pending" | "approved" | "rejected";
  // Auto-test de publication (voir /api/launcher/servers/[slug]/self-test) : sert au bouton
  // "Tester pour publication" cote launcher (visible seulement si prive ET pas encore passe).
  selfTestPassedAt: string | null;
  // 19/10 : contacte au moins une fois (sans reponse = « Hors ligne », sinon « Inconnu »).
  pinged: boolean;
};

// Sert la vue "Mes instances" du launcher (route /api/launcher/servers/mine,
// protegee par LAUNCHER_API_KEY comme le reste des routes launcher) : tous
// les serveurs du proprietaire connecte (identifie par son UUID Minecraft/
// Xbox, voir auth.ts), publies OU en pause — contrairement a
// listPublicServers() qui ne montre que les serveurs publies ET publics.
// Inclut `ip` : le proprietaire connait deja sa propre adresse de connexion
// (meme raisonnement que getServerWithIpBySlug).
async function loadOwnedServersByMinecraftUuid(minecraftUuid: string): Promise<OwnedServerSummary[]> {
  const owner = await db.orm.public.User.select("id").where({ minecraftUuid: normalizeMinecraftUuid(minecraftUuid) }).first();
  if (!owner) return [];

  const rows = await db.orm.public.Server.select(
    "id",
    "slug",
    "name",
    "iconUrl",
    "type",
    "minecraftVersion",
    "ip",
    "published",
    "isPrivate",
    "frozenAt",
    "frozenReason",
    "inviteCode",
    "playerCount",
    "playerCapacity",
    "recommendedRamGB",
    "verificationStatus",
    "selfTestPassedAt",
    "lastPingedAt",
  )
    .where({ ownerId: owner.id })
    .orderBy((s) => s.createdAt.desc())
    .all();

  return rows.map(({ lastPingedAt, ...row }) => ({ ...row, pinged: lastPingedAt != null }));
}

// « Mes instances » : résultat gardé 60 secondes par compte (vidé aussi par les actions admin).
export const listServersOwnedByMinecraftUuid = unstable_cache(loadOwnedServersByMinecraftUuid, ["owned-servers-v2"], {
  revalidate: OWNED_SERVERS_SECONDS,
  tags: [SERVERS_CACHE_TAG],
});

// Resout un code d'invitation vers la fiche du serveur prive correspondant
// (voir /join/[code]) — jamais expose autrement qu'ici, puisque
// listPublicServers() exclut deja les serveurs prives de l'annuaire.
// Pas de condition verificationStatus ici : un code d'invitation est deja la preuve d'un
// cercle ferme (prive), la meme logique que canSeeServer — la file de verification protege
// l'annuaire public, pas l'acces prive par invitation.
export async function getSlugByInviteCode(code: string): Promise<string | null> {
  const row = await db.orm.public.Server.select("slug").where({ inviteCode: code, published: true }).first();
  return row?.slug ?? null;
}

// Accueil (design 2026-10-17, point 2) : quelques serveurs EN LIGNE tires au
// hasard a chaque affichage — regle equitable, jamais toujours les memes ni
// les plus gros. Aucune lecture de base en plus : meme cache d'une minute que
// l'annuaire (limite d'appels Cloudflare). `total` = nombre de serveurs en
// ligne, `servers` = jusqu'a `pool` d'entre eux deja melanges (l'accueil en
// montre 3 et le bouton « Melanger » pioche dans le reste, sans recharger).
export async function sampleOnlineServers(pool = 12): Promise<{ total: number; servers: PublicServerSummary[] }> {
  const online = (await loadPublishedServersLive()).map(asFilterable).filter((s) => s.playerCount != null);
  for (let i = online.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [online[i], online[j]] = [online[j], online[i]];
  }
  const picked = online.slice(0, pool);
  scheduleStatusRefresh(picked.slice(0, 3).map((s) => s.row));
  const now = Date.now();
  return { total: online.length, servers: picked.map((s) => toSummary(s, now)) };
}

// Serveurs publics d'une team (page /team/<slug>, encadre « Autres serveurs de la team ») : ceux
// que le proprietaire a mis dans cette team (server.teamId), tires de la meme liste en cache que
// l'annuaire, aucun appel D1 en plus. Meme tri que l'annuaire par
// defaut : aucun avantage pour une team, la team Omniscient comprise.
export async function listTeamServers(teamSlug: string, exceptSlug?: string): Promise<PublicServerSummary[]> {
  const rows = (await loadPublishedServersLive()).filter((r) => teamBadgeFor(r)?.slug === teamSlug && r.slug !== exceptSlug);
  const { sorted } = await filterAndSort(rows, {});
  const now = Date.now();
  return sorted.map((s) => toSummary(s, now));
}

// ---------------------------------------------------------------------------------------------
// « Petit serveur du jour » (19/10, variante A choisie par Rushi). Choix AUTOMATIQUE et GRATUIT,
// montre seulement sur l'accueil (site, et launcher via /api/launcher/servers/featured), jamais
// dans le classement de l'annuaire. Pour mettre en avant les petits serveurs qui demarrent.
//
// Eligible : publie, verifie, public (liste de l'annuaire), contacte, entre 3 et 500 joueurs en
// ligne, et au moins une langue. Note : remplissage (joueurs / maximum, 0 sans maximum) x 2 +
// lancements depuis le launcher sur 7 jours (plafonnes a 100) x 2 + 1 si « Nouveau ».
// Rotation : les 10 meilleurs, ranges par slug, et celui du rang (numero du jour % 10). Tant que
// ces 10 changent peu, un serveur ne revient pas avant 10 jours ; une vraie garantie « pas deux
// fois en 7 jours » demanderait de garder les choix en base (avec le releve horaire des joueurs,
// migration preparee, pas lancee).
//
// Budget D1 : le choix est calcule une fois par jour (cache par date, heure de Bruxelles) a partir
// de la liste deja en cache et d'UNE requete groupee sur les lancements (elle aussi en cache).
// Les chiffres affiches viennent de la liste en cache : aucun appel en plus par visite.
const DAY_PICK_MIN_PLAYERS = 3;
const DAY_PICK_MAX_PLAYERS = 500;
const DAY_PICK_POOL = 10;
const DAY_MS_PICK = 24 * 60 * 60 * 1000;

export type ServerOfTheDay = {
  day: string;
  server: PublicServerSummary;
  launches7d: number;
  fillPercent: number | null;
};

function brusselsDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(now);
}

const loadLaunches7d = unstable_cache(
  async (day: string): Promise<Record<string, number>> => {
    const since = new Date(Date.parse(`${day}T00:00:00Z`) - 7 * DAY_MS_PICK).toISOString();
    const rows = (await execSql(
      `SELECT "serverId" AS "id", COUNT(*) AS "n" FROM "serverEvent" WHERE "kind" = 'launch' AND "createdAt" >= ? GROUP BY "serverId"`,
      [since],
    )) as unknown as { id: string; n: number }[];
    return Object.fromEntries(rows.map((r) => [r.id, Number(r.n) || 0]));
  },
  ["launches-7d-v1"],
  { revalidate: 24 * 60 * 60 },
);

// Le slug choisi pour la journee (en cache) ; les chiffres sont relus a chaque affichage.
const pickSlugOfTheDay = unstable_cache(
  async (day: string): Promise<string | null> => {
    const [rows, launches] = await Promise.all([loadPublishedServersLive(), loadLaunches7d(day)]);
    const now = Date.now();
    const scored = rows
      .filter(
        (r) =>
          r.lastPingedAt != null &&
          r.playerCount != null &&
          r.playerCount >= DAY_PICK_MIN_PLAYERS &&
          r.playerCount <= DAY_PICK_MAX_PLAYERS &&
          r.languages.length > 0,
      )
      .map((r) => {
        const fill = r.playerCapacity ? Math.min((r.playerCount ?? 0) / r.playerCapacity, 1) : 0;
        const l7 = Math.min(launches[r.id] ?? 0, 100) / 100;
        return { slug: r.slug, score: fill * 2 + l7 * 2 + (isNewServer(r.createdAt, now) ? 1 : 0) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, DAY_PICK_POOL)
      .sort((a, b) => a.slug.localeCompare(b.slug));
    if (!scored.length) return null;
    const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS_PICK);
    return scored[dayNumber % scored.length].slug;
  },
  ["server-of-the-day-v1"],
  { revalidate: 24 * 60 * 60, tags: [SERVERS_CACHE_TAG] },
);

export async function getServerOfTheDay(): Promise<ServerOfTheDay | null> {
  const day = brusselsDay();
  const slug = await pickSlugOfTheDay(day);
  if (!slug) return null;
  const [rows, launches] = await Promise.all([loadPublishedServersLive(), loadLaunches7d(day)]);
  const row = rows.find((r) => r.slug === slug);
  // Retire de l'annuaire entre-temps (gel, pause) : pas de bloc plutot qu'un lien mort.
  if (!row) return null;
  const server = toSummary(asFilterable(row));
  const fillPercent =
    server.playerCount != null && server.playerCapacity ? Math.min(100, Math.round((server.playerCount / server.playerCapacity) * 100)) : null;
  return { day, server, launches7d: launches[row.id] ?? 0, fillPercent };
}

// Admin « Remplacer une etiquette » (23/10) : nombre de fiches publiques par etiquette, lu dans la
// liste en cache (0 appel D1 de plus, et sans relancer de mesures comme listPublicServers).
export async function countPublicServersByTag(): Promise<Map<string, number>> {
  const usage = new Map<string, number>();
  for (const row of await loadPublishedServers()) for (const tag of row.tags) usage.set(tag, (usage.get(tag) ?? 0) + 1);
  return usage;
}
