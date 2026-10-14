import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { pingMinecraftServer } from "@/lib/mc-ping";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";
import { CONCURRENCY } from "@/lib/status-snapshot";

// Point 8 (badge de fraicheur) : re-verifie la DISPONIBILITE RESEAU (pas l'auto-test complet
// du launcher, voir selfTestPassedAt/lib/freshness.ts) de tous les serveurs publies/approuves,
// meme protection CRON_SECRET que /api/cron/process-scheduled et /api/cron/process-appeals —
// appelee toutes les 5 min par le meme petit Worker Cloudflare (voir cron-worker/, 3e appel).
// Utile pour un serveur peu visite : getServerStatus (server-status.ts) ne re-mesure QUE quand
// quelqu'un consulte sa fiche, donc lastPingedAt peut rester perime indefiniment sans visite —
// ce cron le rafraichit independamment du trafic.
//
// Reutilise pingMinecraftServer ET le decoupage en lots de status-snapshot.ts (CONCURRENCY) :
// ne duplique ni la logique de ping, ni la taille des lots — seulement leur enchainement ici,
// en ecrivant en base a chaque lot (status-snapshot.ts ne fait que construire un instantane en
// cache, jamais d'ecriture).
export const maxDuration = 60; // a verifier contre le plan Vercel reel une fois deploye (voir rapport)

export async function POST(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Meme filtre que status-snapshot.ts/listPublicServers (audit §2.17) : un serveur en
  // attente/rejete/prive ne doit pas voir son statut reseau mesure/expose par ce cron.
  const rows = await db.orm.public.Server.select("id", "ip").where({ published: true, isPrivate: false, verificationStatus: "approved" }).all();

  let online = 0;
  const now = () => new Date().toISOString();
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(
      rows.slice(i, i + CONCURRENCY).map(async (row: { id: string; ip: string }) => {
        const status = await pingMinecraftServer(row.ip);
        if (status) online++;
        await db.orm.public.Server.where({ id: row.id }).update(
          status
            ? { playerCount: status.online, playerCapacity: status.max, lastPingedAt: now() }
            : { playerCount: null, playerCapacity: null, lastPingedAt: now() },
        );
      }),
    );
  }

  // Chiffres a jour tout de suite (annuaire, fiches, "Mes instances" du launcher) plutot que
  // d'attendre jusqu'a 60s (SERVERS_CACHE_TAG) — meme principe que process-appeals/route.ts.
  if (rows.length) revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, checked: rows.length, online });
}
