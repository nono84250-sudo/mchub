import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, LAUNCHER_SESSION_HEADER, normalizeMinecraftUuid, verifyLauncherProfile } from "@/lib/launcherAuth";
import { readLauncherSession } from "@/lib/launcherSession";
import { listNotificationsForRecipient } from "@/lib/notifications";
import { getLauncherStatus } from "@/lib/platformSettings";
import { recordPresenceHeartbeat, recordSessionPresence } from "@/lib/presence";
import { listPublicServers } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";
import { findOrCreateUserByMinecraft } from "@/lib/users";
import { withD1Busy } from "@/lib/d1Busy";

// Idee 2 du lancement (19/10) : signal groupe du launcher, une fois par minute. Remplace trois
// appels separes (presence chaque minute, maintenance toutes les 2 min, notifications toutes les
// 5 min) qui coutaient ~4 lectures/ecritures de la base par minute et par joueur, alors que
// Cloudflare limite a ~1 200 appels / 5 min pour tout le site.
// - Presence : 1 seule requete (recordSessionPresence) dans le cas normal (jeton de session).
//   Sinon, exactement le chemin de /api/launcher/presence (anciens launchers, compte a creer,
//   compte supprime, jeton revoque) : meme resultat, juste plus cher.
// - Maintenance : lue en cache partage (getLauncherStatus), 0 appel par joueur.
// - Notifications : seulement si le launcher les demande (withNotifications, 1 fois sur 5).
// Les anciennes routes restent en place pour les launchers deja installes.
export const POST = withD1Busy(async (request: Request) => {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-pulse", 120);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const minecraftUuid = typeof body.minecraftUuid === "string" ? normalizeMinecraftUuid(body.minecraftUuid) : null;
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }

  // Meme regle que la presence : un serveur prive ou inconnu n'est jamais montre aux amis.
  const requestedSlug = typeof body.playingSlug === "string" ? body.playingSlug.trim().slice(0, 80) : "";
  const playingSlug = requestedSlug && (await listPublicServers()).some((s) => s.slug === requestedSlug) ? requestedSlug : null;

  const token = request.headers.get(LAUNCHER_SESSION_HEADER);
  const claims = token ? readLauncherSession(token) : null;
  const fast = claims && claims.uuid === minecraftUuid ? await recordSessionPresence(minecraftUuid, claims.issuedAt, playingSlug) : null;
  if (!fast) {
    const { check: identity, name } = await verifyLauncherProfile(request, minecraftUuid);
    if (identity !== "verified") return identityErrorResponse(identity);
    const user = await findOrCreateUserByMinecraft(minecraftUuid, name, { explicit: false });
    if (!user) return NextResponse.json({ ok: true, accountDeleted: true });
    await recordPresenceHeartbeat(user.id, playingSlug);
  }

  const [status, notifications] = await Promise.all([
    getLauncherStatus(),
    body.withNotifications === true ? listNotificationsForRecipient(minecraftUuid) : Promise.resolve(undefined),
  ]);
  return NextResponse.json({ ok: true, maintenance: status.maintenance, ...(notifications ? { notifications } : {}) });
});
