import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, LAUNCHER_SESSION_HEADER, normalizeMinecraftUuid, verifyLauncherProfile } from "@/lib/launcherAuth";
import { readLauncherSession } from "@/lib/launcherSession";
import { execSqlBatch } from "@/lib/db";
import { listNotificationsForRecipient, notificationsFromRows, notificationsStatement } from "@/lib/notifications";
import { getLauncherStatus } from "@/lib/platformSettings";
import { recordPresenceHeartbeat, sessionPresenceStatement } from "@/lib/presence";
import { listPublicServers } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";
import { findOrCreateUserByMinecraft } from "@/lib/users";
import { withD1Busy } from "@/lib/d1Busy";
import { requireLauncherFeature } from "@/lib/features";
import { friendsOverviewFromRows, friendsStatement, listFriendsOverview } from "@/lib/friends";

// Idee 2 du lancement (19/10) : signal groupe du launcher (une fois par minute a l'origine). Remplace trois
// appels separes (presence chaque minute, maintenance toutes les 2 min, notifications toutes les
// 5 min) qui coutaient ~4 lectures/ecritures de la base par minute et par joueur, alors que
// Cloudflare limite a ~1 200 appels / 5 min pour tout le site.
// - Presence : 1 seule requete (recordSessionPresence) dans le cas normal (jeton de session).
//   Sinon, exactement le chemin de /api/launcher/presence (anciens launchers, compte a creer,
//   compte supprime, jeton revoque) : meme resultat, juste plus cher.
// - Maintenance : lue en cache partage (getLauncherStatus), 0 appel par joueur.
// - Notifications : seulement si le launcher les demande (withNotifications, environ toutes les 5 min).
// - Amis (correctif 3 de l'audit du 28/10) : seulement si le launcher les demande (withFriends,
//   quand une liste de serveurs est affichee et au plus toutes les 5 min). Meme reponse que
//   GET /api/launcher/friends, mais sans refaire le controle d'identite ni chercher le compte :
//   ~2 appels a la base au lieu de ~4. Meme verrou du Laboratoire que cette route.
// 28/10 : le launcher n'envoie plus ce signal que toutes les 3 min hors partie (5 min fenetre
// reduite ou en jeu) ; le site garde un joueur « en ligne » 7 min (ONLINE_WINDOW_SECONDS).
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
  const wantsNotifications = body.withNotifications === true;
  const wantsFriends = body.withFriends === true && !(await requireLauncherFeature(request, "friends"));
  // Cas normal (audit du 01/11, S2) : présence, notifications et amis en UN SEUL appel à la base, au
  // lieu de 3 ou 4. Sans jeton valable, on retombe plus bas sur le chemin complet.
  if (claims && claims.uuid === minecraftUuid) {
    const statements = [
      sessionPresenceStatement(minecraftUuid, claims.issuedAt, playingSlug),
      ...(wantsNotifications ? [notificationsStatement(minecraftUuid)] : []),
      ...(wantsFriends ? [friendsStatement('(SELECT "id" FROM "user" WHERE "minecraftUuid" = ?)', minecraftUuid)] : []),
    ];
    const results = await execSqlBatch(statements);
    const accountId = (results[0][0] as { userId?: string } | undefined)?.userId;
    if (accountId) {
      const status = await getLauncherStatus();
      return NextResponse.json({
        ok: true,
        maintenance: status.maintenance,
        disruption: status.disruption,
        ...(wantsNotifications ? { notifications: notificationsFromRows(results[1]) } : {}),
        ...(wantsFriends ? { friends: friendsOverviewFromRows(results[results.length - 1] as Parameters<typeof friendsOverviewFromRows>[0], accountId) } : {}),
      });
    }
  }
  let userId: string | null = null;
  {
    const { check: identity, name } = await verifyLauncherProfile(request, minecraftUuid);
    if (identity !== "verified") return identityErrorResponse(identity);
    const user = await findOrCreateUserByMinecraft(minecraftUuid, name, { explicit: false });
    if (!user) return NextResponse.json({ ok: true, accountDeleted: true });
    await recordPresenceHeartbeat(user.id, playingSlug);
    userId = user.id;
  }
  const accountId = userId;

  // Amis : ignores sans erreur si la fonction est cachee pour ce joueur (le launcher garde alors
  // sa liste actuelle) ou si la lecture rate (la presence, elle, est deja enregistree).
  const loadFriends = async () => {
    if (!wantsFriends) return undefined;
    return listFriendsOverview(accountId).catch((error) => {
      console.error("[pulse] amis illisibles", error);
      return undefined;
    });
  };
  const [status, notifications, friends] = await Promise.all([
    getLauncherStatus(),
    wantsNotifications ? listNotificationsForRecipient(minecraftUuid) : Promise.resolve(undefined),
    loadFriends(),
  ]);
  return NextResponse.json({
    ok: true,
    maintenance: status.maintenance,
    disruption: status.disruption,
    ...(notifications ? { notifications } : {}),
    ...(friends ? { friends } : {}),
  });
});
