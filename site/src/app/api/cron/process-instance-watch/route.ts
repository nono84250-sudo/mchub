import { NextResponse } from "next/server";
import { db, or } from "@/lib/db";
import { pingMinecraftServer } from "@/lib/mc-ping";
import { CONCURRENCY } from "@/lib/status-snapshot";
import { createNotification } from "@/lib/notifications";

// Point 9 (case "Me prévenir du changement de statut de cette instance", voir
// INSTANCE_SETTINGS_FIELDS côté launcher et instanceWatch dans schema.sql) : UN SEUL
// déclencheur — une instance SUIVIE (possédée OU rejointe, pas seulement les favoris) repasse
// en ligne après avoir été hors ligne. Jamais l'inverse (en ligne -> hors ligne) : on met juste
// à jour lastKnownOnline sans notifier, voir plus bas. Protégée par CRON_SECRET comme
// process-scheduled/process-appeals/recheck-reachability — 4e appel, voir cron-worker/src/index.js.
//
// Deux phases volontairement séparées :
//   1. Ping réseau de chaque serveur DISTINCT suivi (un seul ping même si plusieurs joueurs
//      suivent le même serveur) — réutilise pingMinecraftServer ET le découpage CONCURRENCY de
//      status-snapshot.ts (même principe que recheck-reachability/route.ts), sans rapport avec
//      les vagues de la phase 2.
//   2. Traitement des lignes instanceWatch PAR PETITS LOTS espacés de NOTIFY_BATCH_DELAY_MS
//      (idée de l'utilisateur) : créer une notification et écrire en base pour chaque lot, puis
//      attendre, plutôt que d'envoyer tout d'un coup — pour ne jamais faire porter un pic de
//      charge instantané au site/au cron même si beaucoup de joueurs suivent beaucoup
//      d'instances.
export const maxDuration = 60;

const NOTIFY_BATCH_SIZE = 15;
const NOTIFY_BATCH_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const watchRows: { id: string; minecraftUuid: string; serverId: string; lastKnownOnline: boolean }[] =
    await db.orm.public.InstanceWatch.select("id", "minecraftUuid", "serverId", "lastKnownOnline")
      .where({ notifyOnStatusChange: true })
      .all();

  if (watchRows.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, notified: 0 });
  }

  // Phase 1 : etat reseau actuel de chaque serveur DISTINCT suivi. Les serveurs prives
  // (rejoints via code) sont inclus : ce cron ne lit que ce que CE joueur suit deja, pas
  // l'annuaire public (pas le meme filtre que status-snapshot.ts/recheck-reachability, qui ne
  // regardent eux que les fiches publiques/approuvees). or(...) (lib/db.ts) plutot qu'un IN :
  // ce petit ORM n'a pas d'operateur IN expose, seulement eq/gte/lt/isNull combinables via or().
  const serverIds = [...new Set(watchRows.map((w) => w.serverId))];
  const servers: { id: string; ip: string; name: string }[] = serverIds.length
    ? await db.orm.public.Server.select("id", "ip", "name")
        .where((c) => or(...serverIds.map((id) => c.id.eq(id))))
        .all()
    : [];
  const serverById = new Map(servers.map((s) => [s.id, s]));

  const onlineByServerId = new Map<string, boolean>();
  for (let i = 0; i < serverIds.length; i += CONCURRENCY) {
    const batch = serverIds.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (id) => {
        const server = serverById.get(id);
        if (!server) {
          onlineByServerId.set(id, false);
          return;
        }
        const status = await pingMinecraftServer(server.ip);
        onlineByServerId.set(id, !!status);
      }),
    );
  }

  // Phase 2 : lignes instanceWatch traitees par petits lots espaces dans le temps (voir
  // commentaire en tete de fichier) — jamais toutes d'un coup.
  let notified = 0;
  for (let i = 0; i < watchRows.length; i += NOTIFY_BATCH_SIZE) {
    const batch = watchRows.slice(i, i + NOTIFY_BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        const online = onlineByServerId.get(row.serverId) ?? false;
        const wasOnline = row.lastKnownOnline;
        if (online === wasOnline) return;

        if (online && !wasOnline) {
          const server = serverById.get(row.serverId);
          await createNotification({
            recipientMinecraftUuid: row.minecraftUuid,
            type: "instance_back_online",
            serverName: server?.name ?? "",
          });
          notified++;
        }
        // En ligne -> hors ligne : pas de notification (declencheur demande uniquement
        // "repasse en ligne"), seulement l'etat memorise pour detecter la PROCHAINE transition.
        await db.orm.public.InstanceWatch.where({ id: row.id }).update({ lastKnownOnline: online });
      }),
    );
    if (i + NOTIFY_BATCH_SIZE < watchRows.length) await sleep(NOTIFY_BATCH_DELAY_MS);
  }

  return NextResponse.json({ ok: true, checked: watchRows.length, servers: serverIds.length, notified });
}
