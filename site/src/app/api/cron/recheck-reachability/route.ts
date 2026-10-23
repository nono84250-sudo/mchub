import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db, execSql } from "@/lib/db";
import { pingMinecraftServer } from "@/lib/mc-ping";
import { SERVERS_LIVE_CACHE_TAG } from "@/lib/public-servers";
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
// 21/10 (cache des fiches) : les resultats sont ecrits en paquets (une requete pour
// WRITE_BATCH_SIZE serveurs, au lieu d'une par serveur), en SQL direct pour ne PAS changer
// updatedAt (ce n'est pas une modification de la fiche), et seul le cache des joueurs est vide.
// 5 parametres par serveur, D1 en accepte 100 par requete : 19 serveurs par paquet.
const WRITE_BATCH_SIZE = 19;
type PingResult = { id: string; playerCount: number | null; playerCapacity: number | null; at: string };

async function writeResults(results: PingResult[]) {
  for (let i = 0; i < results.length; i += WRITE_BATCH_SIZE) {
    const batch = results.slice(i, i + WRITE_BATCH_SIZE);
    const params: unknown[] = [];
    const caseFor = (column: keyof PingResult) => {
      const parts = batch.map((r) => {
        params.push(r.id, r[column]);
        return "WHEN ? THEN ?";
      });
      return `"${column === "at" ? "lastPingedAt" : column}" = CASE "id" ${parts.join(" ")} END`;
    };
    const sets = [caseFor("playerCount"), caseFor("playerCapacity"), caseFor("at")].join(", ");
    params.push(...batch.map((r) => r.id));
    await execSql(`UPDATE "server" SET ${sets} WHERE "id" IN (${batch.map(() => "?").join(", ")})`, params);
  }
}

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
  const results: PingResult[] = [];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(
      rows.slice(i, i + CONCURRENCY).map(async (row: { id: string; ip: string }) => {
        const status = await pingMinecraftServer(row.ip);
        if (status) online++;
        results.push({ id: row.id, playerCount: status ? status.online : null, playerCapacity: status ? status.max : null, at: new Date().toISOString() });
      }),
    );
  }
  await writeResults(results);

  // Chiffres a jour tout de suite (annuaire, fiches, accueil) : seul le cache des joueurs est vide,
  // les infos fixes des fiches restent en cache (voir SERVERS_LIVE_CACHE_TAG dans public-servers.ts).
  if (rows.length) revalidateTag(SERVERS_LIVE_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, checked: rows.length, online });
}
