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
  type: "vanilla" | "modded";
  playerCount: number | null;
  playerCapacity: number | null;
};

export type PublicServerDetail = PublicServerSummary & {
  minecraftVersion: string;
  curseforgeModpackName: string | null;
  curseforgeModpackVersion: string | null;
};

export async function listPublicServers(): Promise<PublicServerSummary[]> {
  const rows = await db.orm.public.Server.select(
    "id",
    "slug",
    "name",
    "description",
    "bannerUrl",
    "type",
    "ip",
    "playerCount",
    "playerCapacity",
    "lastPingedAt",
  )
    .orderBy((s) => s.createdAt.desc())
    .all();

  return Promise.all(
    rows.map(async (row) => {
      const status = await getServerStatus(row.id, row.ip, row);
      return {
        slug: row.slug,
        name: row.name,
        description: row.description,
        bannerUrl: row.bannerUrl,
        type: row.type,
        playerCount: status.playerCount,
        playerCapacity: status.playerCapacity,
      };
    }),
  );
}

export async function getPublicServerBySlug(slug: string): Promise<PublicServerDetail | null> {
  const row = await db.orm.public.Server.select(
    "id",
    "slug",
    "name",
    "description",
    "bannerUrl",
    "type",
    "minecraftVersion",
    "ip",
    "curseforgeModpackName",
    "curseforgeModpackVersion",
    "playerCount",
    "playerCapacity",
    "lastPingedAt",
  )
    .where({ slug })
    .first();

  if (!row) return null;

  const status = await getServerStatus(row.id, row.ip, row);

  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerUrl: row.bannerUrl,
    type: row.type,
    minecraftVersion: row.minecraftVersion,
    curseforgeModpackName: row.curseforgeModpackName,
    curseforgeModpackVersion: row.curseforgeModpackVersion,
    playerCount: status.playerCount,
    playerCapacity: status.playerCapacity,
  };
}
