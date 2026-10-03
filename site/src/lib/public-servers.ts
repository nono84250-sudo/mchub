import { timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/prisma/db";
import { getServerStatus, scheduleStatusRefresh } from "@/lib/server-status";
import { LAUNCHER_SESSION_HEADER, normalizeMinecraftUuid, sessionIdentity, verifyMinecraftIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Etiquette du cache des donnees publiques des serveurs : les actions du site
// (creer, modifier, publier, mettre en pause, supprimer) l'invalident avec
// updateTag(SERVERS_CACHE_TAG), donc un changement du proprietaire est visible
// tout de suite. Sans changement, la base n'est lue qu'une fois par minute (la
// minute laisse aussi aux chiffres de joueurs en ligne le temps d'arriver).
export const SERVERS_CACHE_TAG = "servers";
const SERVERS_CACHE_SECONDS = 60;
// Annuaire : nombre de serveurs par page.
export const SERVERS_PAGE_SIZE = 24;

// Point d'accès unique aux données "publiques" d'un serveur (annuaire du
// site ET API publique consommée par le launcher, cf. section 3 du cahier
// des charges — "modèle de synchronisation"). `ip` est toujours lue en
// base pour permettre le ping, mais n'est jamais incluse dans les types
// retournés ici : c'est la seule garantie qu'elle ne peut pas fuiter par
// erreur vers une page ou une réponse API publique.

export type PublicServerSummary = {
  slug: string;
  name: string;
  description: string;
  bannerUrl: string | null;
  iconUrl: string | null;
  type: "vanilla" | "modded";
  playerCount: number | null;
  playerCapacity: number | null;
  createdAt: string;
  viewCount: number;
  // UUID Minecraft du proprietaire (toujours renseigne desormais : voir
  // auth.ts, la connexion se fait uniquement via Microsoft/Xbox) — permet au
  // launcher d'afficher un badge "Owner" sur ses propres serveurs dans
  // l'annuaire, en comparant a son propre profil deja connu localement
  // (aucune donnee de session ne remonte au site).
  ownerMinecraftUuid: string | null;
};

export type ServerListSort = "recent" | "popular" | "az";

export type ListPublicServersOptions = {
  q?: string;
  sort?: ServerListSort;
};

export type PublicServerDetail = PublicServerSummary & {
  minecraftVersion: string;
  curseforgeModpackName: string | null;
  curseforgeModpackVersion: string | null;
  recommendedRamGB: number | null;
  backgroundUrl: string | null;
};

// Filtre et tri faits en JS plutot que dans la requete : a l'echelle d'un
// annuaire perso (quelques dizaines de serveurs), c'est largement suffisant
// et evite d'apprendre la syntaxe "contains" du lane ORM Prisma 8 pour un
// gain de performance qui ne se verrait pas ici (meme raisonnement que le
// bucketing de la page Activite, voir server-activity.ts).
// Tous les serveurs publies et publics, lus en base au plus une fois par minute
// (et des qu'un proprietaire change quelque chose : SERVERS_CACHE_TAG). Contient
// `id`, `ip` et `lastPingedAt` pour la mesure des joueurs en ligne — cote serveur
// uniquement : jamais renvoyes par les fonctions publiques ci-dessous. Limite : le
// cache de donnees de Vercel accepte 2 Mo par entree, soit environ 3 000 serveurs ;
// au-dela il faudra paginer dans la requete SQL.
const loadPublishedServers = unstable_cache(
  async () =>
    db.orm.public.Server.select(
      "id",
      "slug",
      "name",
      "description",
      "bannerUrl",
      "iconUrl",
      "type",
      "ip",
      "playerCount",
      "playerCapacity",
      "lastPingedAt",
      "createdAt",
      "viewCount",
    )
      .include("owner", (o) => o.select("minecraftUuid"))
      .where({ published: true, isPrivate: false })
      .orderBy((s) => s.createdAt.desc())
      .all(),
  ["published-servers"],
  { revalidate: SERVERS_CACHE_SECONDS, tags: [SERVERS_CACHE_TAG] },
);

type PublishedServerRow = Awaited<ReturnType<typeof loadPublishedServers>>[number];

function filterAndSort(rows: PublishedServerRow[], { q, sort = "recent" }: ListPublicServersOptions): PublishedServerRow[] {
  const needle = q?.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((row) => row.name.toLowerCase().includes(needle) || row.description.toLowerCase().includes(needle))
    : rows;

  return [...filtered].sort((a, b) => {
    if (sort === "popular") return b.viewCount - a.viewCount;
    if (sort === "az") return a.name.localeCompare(b.name);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function toSummary(row: PublishedServerRow): PublicServerSummary {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerUrl: row.bannerUrl,
    iconUrl: row.iconUrl,
    type: row.type,
    playerCount: row.playerCount,
    playerCapacity: row.playerCapacity,
    createdAt: row.createdAt,
    viewCount: row.viewCount,
    ownerMinecraftUuid: row.owner?.minecraftUuid ?? null,
  };
}

// Liste complete (API publique consommee par le launcher).
export async function listPublicServers(options: ListPublicServersOptions = {}): Promise<PublicServerSummary[]> {
  const sorted = filterAndSort(await loadPublishedServers(), options);

  // L'affichage montre le dernier chiffre enregistré ; les statuts périmés sont
  // re-mesurés après l'envoi de la page (voir server-status.ts).
  scheduleStatusRefresh(sorted);
  return sorted.map(toSummary);
}

export type PublicServersPage = {
  servers: PublicServerSummary[];
  total: number;
  page: number;
  pageCount: number;
};

// Une page de l'annuaire (SERVERS_PAGE_SIZE serveurs) : evite d'envoyer et de
// construire des centaines de cartes a chaque visite. `page` est ramenee dans
// les bornes (une page trop grande donne la derniere).
export async function listPublicServersPage(options: ListPublicServersOptions & { page?: number }): Promise<PublicServersPage> {
  const sorted = filterAndSort(await loadPublishedServers(), options);
  const pageCount = Math.max(1, Math.ceil(sorted.length / SERVERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1) || 1), pageCount);
  const slice = sorted.slice((page - 1) * SERVERS_PAGE_SIZE, page * SERVERS_PAGE_SIZE);

  // Seuls les serveurs affiches sont re-mesures en priorite.
  scheduleStatusRefresh(slice);
  return { servers: slice.map(toSummary), total: sorted.length, page, pageCount };
}

export type LauncherServerDetail = {
  name: string;
  type: "vanilla" | "modded";
  ip: string;
  minecraftVersion: string;
  curseforgeModpackId: string | null;
  recommendedRamGB: number | null;
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

export async function canSeeServer(
  server: { isPrivate: boolean; inviteCode: string | null; owner: { minecraftUuid: string | null } | null },
  proof: PrivateServerProof,
): Promise<boolean> {
  if (!server.isPrivate) return true;
  const code = proof.inviteCode?.trim().toUpperCase();
  if (code && server.inviteCode && sameCode(code, server.inviteCode)) return true;
  // Jeton de session present : il decide seul (proprietaire = UUID du jeton).
  if (proof.launcherSession != null) {
    const uuid = await sessionIdentity(proof.launcherSession);
    const owner = server.owner?.minecraftUuid;
    return !!uuid && !!owner && uuid === normalizeMinecraftUuid(owner);
  }
  return (await verifyMinecraftIdentity(proof.minecraftToken ?? null, server.owner?.minecraftUuid ?? null)) === "verified";
}

// Routes d'ecriture par slug (signalement, compteur de lancements) : un serveur
// prive sans la preuve renvoie null, comme un slug inconnu — sinon la reponse
// (200 ou 404) reveleraient qu'un serveur prive existe.
export async function visibleServerIdBySlug(slug: string, proof: PrivateServerProof): Promise<string | null> {
  const row = await db.orm.public.Server.select("id", "isPrivate", "inviteCode")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  if (!row || !(await canSeeServer(row, proof))) return null;
  return row.id;
}

// Seule fonction du fichier qui renvoie `ip` — réservée à la route
// /api/launcher/servers/[slug], protégée par LAUNCHER_API_KEY. Ne jamais
// exposer ce résultat via une route publique.
export async function getServerWithIpBySlug(slug: string, proof: PrivateServerProof = {}): Promise<LauncherServerDetail | null> {
  const row = await db.orm.public.Server.select(
    "name",
    "type",
    "ip",
    "minecraftVersion",
    "curseforgeModpackId",
    "recommendedRamGB",
    "isPrivate",
    "inviteCode",
  )
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug, published: true })
    .first();

  if (!row || !(await canSeeServer(row, proof))) return null;

  return {
    name: row.name,
    type: row.type,
    ip: row.ip,
    minecraftVersion: row.minecraftVersion,
    curseforgeModpackId: row.curseforgeModpackId,
    recommendedRamGB: row.recommendedRamGB,
  };
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
  const plan = db.raw.sql`WITH bumped AS (
      UPDATE "server" SET "viewCount" = "viewCount" + 1 WHERE "slug" = ${slug} RETURNING "id"
    )
    INSERT INTO "serverEvent" ("id", "serverId", "kind") SELECT gen_random_uuid()::text, "id", 'view' FROM bumped`
    .affectedCount()
    .build();
  await db.runtime().execute(plan);
}

// Appelee par le launcher (route /api/launcher/servers/[slug]/launch) a
// chaque lancement reussi — meme instruction atomique que recordServerView.
export async function recordServerLaunch(slug: string): Promise<void> {
  const plan = db.raw.sql`WITH bumped AS (
      UPDATE "server" SET "launchCount" = "launchCount" + 1 WHERE "slug" = ${slug} RETURNING "id"
    )
    INSERT INTO "serverEvent" ("id", "serverId", "kind") SELECT gen_random_uuid()::text, "id", 'launch' FROM bumped`
    .affectedCount()
    .build();
  await db.runtime().execute(plan);
}

// Fiche publique lue en cache, comme la liste (meme etiquette : voir SERVERS_CACHE_TAG).
// Le slug est un argument de la fonction, donc il fait partie de la cle du cache.
const loadPublishedServerBySlug = unstable_cache(
  async (slug: string) =>
    (await db.orm.public.Server.select(
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
    "curseforgeModpackName",
    "curseforgeModpackVersion",
    "playerCount",
    "playerCapacity",
    "lastPingedAt",
    "recommendedRamGB",
    "createdAt",
    "viewCount",
    "isPrivate",
    "inviteCode",
  )
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug, published: true })
    .first()) ?? null,
  ["published-server-by-slug"],
  { revalidate: SERVERS_CACHE_SECONDS, tags: [SERVERS_CACHE_TAG] },
);

// `proof` : sans preuve (site, annuaire), un serveur prive renvoie null.
export async function getPublicServerBySlug(slug: string, proof: PrivateServerProof = {}): Promise<PublicServerDetail | null> {
  const row = await loadPublishedServerBySlug(slug);
  if (!row || !(await canSeeServer(row, proof))) return null;

  const status = await getServerStatus(row.id, row.ip, row);

  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerUrl: row.bannerUrl,
    iconUrl: row.iconUrl,
    backgroundUrl: row.backgroundUrl,
    ownerMinecraftUuid: row.owner?.minecraftUuid ?? null,
    type: row.type,
    minecraftVersion: row.minecraftVersion,
    curseforgeModpackName: row.curseforgeModpackName,
    curseforgeModpackVersion: row.curseforgeModpackVersion,
    playerCount: status.playerCount,
    playerCapacity: status.playerCapacity,
    recommendedRamGB: row.recommendedRamGB,
    createdAt: row.createdAt,
    viewCount: row.viewCount,
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
  inviteCode: string | null;
  playerCount: number | null;
  playerCapacity: number | null;
};

// Sert la vue "Mes instances" du launcher (route /api/launcher/servers/mine,
// protegee par LAUNCHER_API_KEY comme le reste des routes launcher) : tous
// les serveurs du proprietaire connecte (identifie par son UUID Minecraft/
// Xbox, voir auth.ts), publies OU en pause — contrairement a
// listPublicServers() qui ne montre que les serveurs publies ET publics.
// Inclut `ip` : le proprietaire connait deja sa propre adresse de connexion
// (meme raisonnement que getServerWithIpBySlug).
export async function listServersOwnedByMinecraftUuid(minecraftUuid: string): Promise<OwnedServerSummary[]> {
  const owner = await db.orm.public.User.select("id").where({ minecraftUuid }).first();
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
    "inviteCode",
    "playerCount",
    "playerCapacity",
  )
    .where({ ownerId: owner.id })
    .orderBy((s) => s.createdAt.desc())
    .all();

  return rows;
}

// Resout un code d'invitation vers la fiche du serveur prive correspondant
// (voir /join/[code]) — jamais expose autrement qu'ici, puisque
// listPublicServers() exclut deja les serveurs prives de l'annuaire.
export async function getSlugByInviteCode(code: string): Promise<string | null> {
  const row = await db.orm.public.Server.select("slug").where({ inviteCode: code, published: true }).first();
  return row?.slug ?? null;
}
