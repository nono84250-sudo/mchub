import { after } from "next/server";
import { or } from "@prisma/orm-postgres/orm-client";
import { db } from "@/prisma/db";
import { pingMinecraftServer } from "@/lib/mc-ping";

// Durée pendant laquelle un statut mesuré reste valable avant qu'on
// interroge de nouveau le serveur Minecraft.
export const SERVER_STATUS_TTL_MS = 60_000;

// Un serveur qui ne répond pas n'est re-mesuré que toutes les 5 minutes (au lieu
// de 60 s) : une mesure qui échoue attend jusqu'à 3 s, inutile d'y revenir aussi
// souvent. Voir refreshOne (lastPingedAt est alors repoussé dans le futur).
const FAILED_PING_RETRY_MS = 5 * 60_000;

// Mesures simultanées au maximum par instance du site, et serveurs traités au
// maximum par affichage de page : borne le travail et la charge sur la base, même
// avec des centaines de serveurs et beaucoup de visiteurs en même temps.
const MAX_CONCURRENT_REFRESHES = 25;
const MAX_SERVERS_PER_SCHEDULE = 50;

type CachedStatus = {
  playerCount: number | null;
  playerCapacity: number | null;
  lastPingedAt: string | null;
};

export type ServerStatus = {
  playerCount: number | null;
  playerCapacity: number | null;
};

export function isStatusStale(lastPingedAt: string | null): boolean {
  if (!lastPingedAt) return true;
  return Date.now() - new Date(lastPingedAt).getTime() > SERVER_STATUS_TTL_MS;
}

// Serveurs dont une mesure est déjà en cours dans cette instance : évite que dix
// visiteurs simultanés déclenchent dix fois la même mesure.
const inFlight = new Set<string>();

// Les listes viennent d'un cache (voir public-servers.ts) : leur `lastPingedAt`
// peut rester périmé jusqu'à une minute. Sans ceci, chaque visite reprogrammerait
// la même mesure (une requête de réservation par serveur et par visite, pour rien).
const RESCHEDULE_AFTER_MS = 15_000;
const recentlyScheduled = new Map<string, number>();

let running = 0;
const waiting: Array<() => void> = [];
async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT_REFRESHES) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

// Mesure un serveur et enregistre le résultat. Ne lève jamais.
async function refreshOne(id: string, ip: string): Promise<void> {
  try {
    await withSlot(async () => {
      const now = Date.now();
      // Réservation atomique en base : si une autre instance (ou visite) vient de
      // mesurer ce serveur, la mise à jour ne touche aucune ligne et on s'arrête.
      const claimed = await db.orm.public.Server.where({ id })
        .where((s) => or(s.lastPingedAt.isNull(), s.lastPingedAt.lt(new Date(now - SERVER_STATUS_TTL_MS).toISOString())))
        .update({ lastPingedAt: new Date(now).toISOString() });
      if (!claimed) return;

      const result = await pingMinecraftServer(ip);
      await db.orm.public.Server.where({ id }).update(
        result
          ? { playerCount: result.online, playerCapacity: result.max }
          : {
              playerCount: null,
              playerCapacity: null,
              // Pas de réponse : la prochaine mesure aura lieu dans FAILED_PING_RETRY_MS.
              lastPingedAt: new Date(Date.now() + FAILED_PING_RETRY_MS - SERVER_STATUS_TTL_MS).toISOString(),
            },
      );
    });
  } catch {
    // Un échec de mesure ne doit jamais casser une page : le chiffre reste celui de la dernière mesure.
  } finally {
    inFlight.delete(id);
  }
}

/**
 * Programme, APRÈS l'envoi de la page, la mesure des serveurs dont le statut est
 * périmé (les plus anciens d'abord, MAX_SERVERS_PER_SCHEDULE au plus). L'affichage
 * n'attend jamais une mesure : il montre le dernier chiffre enregistré.
 * `ip` n'est utilisée que côté serveur pour ouvrir la connexion de ping — elle
 * n'est jamais renvoyée à l'appelant.
 */
export function scheduleStatusRefresh(servers: Array<{ id: string; ip: string; lastPingedAt: string | null }>): void {
  const now = Date.now();
  const todo = servers
    .filter((s) => isStatusStale(s.lastPingedAt) && !inFlight.has(s.id) && now - (recentlyScheduled.get(s.id) ?? 0) > RESCHEDULE_AFTER_MS)
    .sort((a, b) => (a.lastPingedAt ?? "").localeCompare(b.lastPingedAt ?? ""))
    .slice(0, MAX_SERVERS_PER_SCHEDULE);
  if (!todo.length) return;

  if (recentlyScheduled.size > 2000) {
    for (const [id, at] of recentlyScheduled) if (now - at > RESCHEDULE_AFTER_MS) recentlyScheduled.delete(id);
  }
  for (const s of todo) {
    inFlight.add(s.id);
    recentlyScheduled.set(s.id, now);
  }
  const work = Promise.all(todo.map((s) => refreshOne(s.id, s.ip)));
  try {
    after(() => work);
  } catch {
    // Hors d'une requête : la mesure tourne quand même, sans être attendue.
  }
}

/**
 * Statut (joueurs en ligne / capacité) d'un serveur : le dernier chiffre
 * enregistré, tout de suite. S'il est périmé, une nouvelle mesure est programmée
 * après l'envoi de la page (elle apparaîtra à la visite suivante).
 */
export async function getServerStatus(serverId: string, ip: string, cached: CachedStatus): Promise<ServerStatus> {
  scheduleStatusRefresh([{ id: serverId, ip, lastPingedAt: cached.lastPingedAt }]);
  return { playerCount: cached.playerCount, playerCapacity: cached.playerCapacity };
}
