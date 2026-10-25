import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Test de connexion avant la première synchro (mode Jouer, 24/10) : le launcher envoie un petit
// fichier (1 Mo au plus) et mesure le temps pris, pour annoncer la durée de l'envoi. Rien n'est
// gardé, ni en base ni dans R2.
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const limited = rateLimitResponse(request, "launcher-worlds-speedtest", 6);
  if (limited) return limited;
  let received = 0;
  const reader = request.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Trop gros" }, { status: 413 });
      }
    }
  }
  return NextResponse.json({ ok: true, received });
}
