import { db } from "@/prisma/db";
import { getServerStatus } from "@/lib/server-status";

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
  // UUID Minecraft du proprietaire (si son compte site est lie, voir
  // minecraftLink.ts) — permet au launcher d'afficher un badge "Owner" sur
  // ses propres serveurs dans l'annuaire, en comparant a son propre profil
  // deja connu localement (aucune donnee de session ne remonte au site).
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
};

// Filtre et tri faits en JS plutot que dans la requete : a l'echelle d'un
// annuaire perso (quelques dizaines de serveurs), c'est largement suffisant
// et evite d'apprendre la syntaxe "contains" du lane ORM Prisma 8 pour un
// gain de performance qui ne se verrait pas ici (meme raisonnement que le
// bucketing de la page Activite, voir server-activity.ts).
export async function listPublicServers(options: ListPublicServersOptions = {}): Promise<PublicServerSummary[]> {
  const { q, sort = "recent" } = options;

  const rows = await db.orm.public.Server.select(
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
    .where({ published: true })
    .orderBy((s) => s.createdAt.desc())
    .all();

  const needle = q?.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((row) => row.name.toLowerCase().includes(needle) || row.description.toLowerCase().includes(needle))
    : rows;

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "popular") return b.viewCount - a.viewCount;
    if (sort === "az") return a.name.localeCompare(b.name);
    return b.createdAt.localeCompare(a.createdAt);
  });

  return Promise.all(
    sorted.map(async (row) => {
      const status = await getServerStatus(row.id, row.ip, row);
      return {
        slug: row.slug,
        name: row.name,
        description: row.description,
        bannerUrl: row.bannerUrl,
        iconUrl: row.iconUrl,
        type: row.type,
        playerCount: status.playerCount,
        playerCapacity: status.playerCapacity,
        createdAt: row.createdAt,
        viewCount: row.viewCount,
        ownerMinecraftUuid: row.owner?.minecraftUuid ?? null,
      };
    }),
  );
}

export type LauncherServerDetail = {
  name: string;
  type: "vanilla" | "modded";
  ip: string;
  minecraftVersion: string;
  curseforgeModpackId: string | null;
  recommendedRamGB: number | null;
};

// Seule fonction du fichier qui renvoie `ip` — réservée à la route
// /api/launcher/servers/[slug], protégée par LAUNCHER_API_KEY. Ne jamais
// exposer ce résultat via une route publique.
export async function getServerWithIpBySlug(slug: string): Promise<LauncherServerDetail | null> {
  const row = await db.orm.public.Server.select(
    "name",
    "type",
    "ip",
    "minecraftVersion",
    "curseforgeModpackId",
    "recommendedRamGB",
  )
    .where({ slug, published: true })
    .first();

  if (!row) return null;

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
// visiteurs confondus). Lecture-puis-ecriture (pas d'increment atomique cote
// ORM Prisma 8) : suffisant pour un compteur indicatif, pas une donnee
// critique — une collision concurrente ferait perdre une vue au pire.
export async function recordServerView(slug: string): Promise<void> {
  const row = await db.orm.public.Server.select("id", "viewCount").where({ slug }).first();
  if (!row) return;
  await db.orm.public.Server.where({ id: row.id }).update({ viewCount: row.viewCount + 1 });
  await db.orm.public.ServerEvent.create({ serverId: row.id, kind: "view" });
}

// Appelee par le launcher (route /api/launcher/servers/[slug]/launch) a
// chaque lancement reussi — meme logique lecture-puis-ecriture que
// recordServerView, meme tolerance pour un compteur indicatif.
export async function recordServerLaunch(slug: string): Promise<void> {
  const row = await db.orm.public.Server.select("id", "launchCount").where({ slug }).first();
  if (!row) return;
  await db.orm.public.Server.where({ id: row.id }).update({ launchCount: row.launchCount + 1 });
  await db.orm.public.ServerEvent.create({ serverId: row.id, kind: "launch" });
}

export async function getPublicServerBySlug(slug: string): Promise<PublicServerDetail | null> {
  const row = await db.orm.public.Server.select(
    "id",
    "slug",
    "name",
    "description",
    "bannerUrl",
    "iconUrl",
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
  )
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug, published: true })
    .first();

  if (!row) return null;

  const status = await getServerStatus(row.id, row.ip, row);

  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerUrl: row.bannerUrl,
    iconUrl: row.iconUrl,
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
  slug: string;
  name: string;
  type: "vanilla" | "modded";
  minecraftVersion: string;
  ip: string;
  published: boolean;
  playerCount: number | null;
  playerCapacity: number | null;
};

// Sert la vue "Mes instances" du launcher (route /api/launcher/servers/mine,
// protegee par LAUNCHER_API_KEY comme le reste des routes launcher) : tous
// les serveurs du proprietaire dont le compte Minecraft est lie a ce compte
// site, publies OU en pause — contrairement a listPublicServers() qui ne
// montre que les serveurs publies. Inclut `ip` : le proprietaire connait
// deja sa propre adresse de connexion (meme raisonnement que
// getServerWithIpBySlug).
export async function listServersOwnedByMinecraftUuid(minecraftUuid: string): Promise<OwnedServerSummary[]> {
  const owner = await db.orm.public.User.select("id").where({ minecraftUuid }).first();
  if (!owner) return [];

  const rows = await db.orm.public.Server.select(
    "slug",
    "name",
    "type",
    "minecraftVersion",
    "ip",
    "published",
    "playerCount",
    "playerCapacity",
  )
    .where({ ownerId: owner.id })
    .orderBy((s) => s.createdAt.desc())
    .all();

  return rows;
}
