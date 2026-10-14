import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { findOrCreateUserByMinecraft } from "@/lib/users";
import { recordPresenceHeartbeat } from "@/lib/presence";

// Heartbeat de présence (système d'amis, 2026-10-14) : greffé sur le vrai cycle de 60s du
// launcher (REFRESH_INTERVAL_MS/scheduleRefresh dans renderer.js — vérifié dans le vrai code
// avant d'écrire cette route, PAS le cycle notifications qui est à 5 min). Exige une session
// Microsoft active côté launcher, comme /api/launcher/servers/mine — un joueur non connecté
// n'a pas d'identité à publier. Indépendant de tout serveur Minecraft précis (voir le rapport :
// le ping réseau existant, lib/mc-ping.ts, ne lit pas la liste des joueurs connectés et n'est
// de toute façon pas fiable pour ça).
export async function POST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // 1 appel/60s par joueur connecté : large marge pour plusieurs joueurs derrière la même
  // adresse (école, LAN party, même raisonnement que notifications/launcher-mine).
  const limited = rateLimitResponse(request, "launcher-presence", 120);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const minecraftUuid = typeof body.minecraftUuid === "string" ? body.minecraftUuid : null;
  const minecraftUsername = typeof body.minecraftUsername === "string" ? body.minecraftUsername : null;
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  const user = await findOrCreateUserByMinecraft(minecraftUuid, minecraftUsername);
  await recordPresenceHeartbeat(user.id);

  return NextResponse.json({ ok: true });
}
