import { NextResponse } from "next/server";
import { processDueAppeals } from "@/lib/appeals";
import { revalidateTag } from "next/cache";
import { SERVERS_CACHE_TAG } from "@/lib/public-servers";

// Même protection que /api/cron/process-scheduled (voir ce fichier) : appelée toutes les 5 min
// par le même petit Worker Cloudflare (cron-worker/), jamais directement par un navigateur.
// Dégèle automatiquement tout serveur dont le recours (72h, voir lib/appeals.ts) est resté sans
// décision admin — "effet suspensif" oblige, l'absence de décision ne doit jamais geler
// indéfiniment.
export async function POST(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const unfrozen = await processDueAppeals();
  if (unfrozen > 0) revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ ok: true, unfrozen });
}
