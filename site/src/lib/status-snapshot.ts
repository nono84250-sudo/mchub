import { unstable_cache } from "next/cache";
import { db } from "@/prisma/db";
import { pingMinecraftServer } from "@/lib/mc-ping";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";

// Une seule mesure partagée de tous les serveurs publics, gardée 60 secondes. Les adresses
// restent sur le site : le launcher ne reçoit que le résultat, par slug.
const SNAPSHOT_SECONDS = 60;
// ponytail: tests par lots de 10 ; ça tient tant qu'il y a quelques centaines de serveurs. Au-delà,
// passer à un cron qui mesure en continu.
const CONCURRENCY = 10;

export type StatusSnapshot = {
  generatedAt: string;
  servers: Record<string, { online: boolean; playerCount: number | null; playerCapacity: number | null }>;
};

async function buildStatusSnapshot(): Promise<StatusSnapshot> {
  const rows = await db.orm.public.Server.select("slug", "ip").where({ published: true, isPrivate: false }).all();
  const servers: StatusSnapshot["servers"] = {};
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(
      rows.slice(i, i + CONCURRENCY).map(async (row) => {
        const status = await pingMinecraftServer(row.ip);
        servers[row.slug] = status
          ? { online: true, playerCount: status.online, playerCapacity: status.max }
          : { online: false, playerCount: null, playerCapacity: null };
      }),
    );
  }
  return { generatedAt: new Date().toISOString(), servers };
}

export const getStatusSnapshot = unstable_cache(buildStatusSnapshot, ["status-snapshot"], {
  revalidate: SNAPSHOT_SECONDS,
  tags: [SERVERS_CACHE_TAG],
});
