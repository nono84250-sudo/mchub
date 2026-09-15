import { db } from "@/prisma/db";
import { pingMinecraftServer } from "@/lib/mc-ping";

// Durée pendant laquelle un statut mesuré reste valable avant qu'on
// interroge de nouveau le serveur Minecraft. Évite de re-pinger tous les
// serveurs à chaque affichage de l'annuaire (voir risque "charge du ping
// en direct" dans le cahier des charges).
export const SERVER_STATUS_TTL_MS = 60_000;

type CachedStatus = {
  playerCount: number | null;
  playerCapacity: number | null;
  lastPingedAt: string | null;
};

export type ServerStatus = {
  playerCount: number | null;
  playerCapacity: number | null;
};

function isStale(lastPingedAt: string | null): boolean {
  if (!lastPingedAt) return true;
  return Date.now() - new Date(lastPingedAt).getTime() > SERVER_STATUS_TTL_MS;
}

/**
 * Retourne le statut (joueurs en ligne / capacité) d'un serveur, en le
 * re-mesurant en direct si la dernière mesure est trop ancienne, sinon en
 * réutilisant la valeur déjà en base. `ip` n'est utilisée que côté serveur
 * pour ouvrir la connexion de ping — elle n'est jamais renvoyée à l'appelant.
 */
export async function getServerStatus(
  serverId: string,
  ip: string,
  cached: CachedStatus,
): Promise<ServerStatus> {
  if (!isStale(cached.lastPingedAt)) {
    return { playerCount: cached.playerCount, playerCapacity: cached.playerCapacity };
  }

  const result = await pingMinecraftServer(ip);
  const next: ServerStatus = result
    ? { playerCount: result.online, playerCapacity: result.max }
    : { playerCount: null, playerCapacity: null };

  await db.orm.public.Server.where({ id: serverId }).update({
    playerCount: next.playerCount,
    playerCapacity: next.playerCapacity,
    lastPingedAt: new Date().toISOString(),
  });

  return next;
}
