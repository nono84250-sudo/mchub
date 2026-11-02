import { NextResponse } from "next/server";
import { identityErrorResponse, isAuthorizedLauncherRequest, verifyLauncherIdentity } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { getInstanceWatch, setInstanceWatch } from "@/lib/instanceWatch";
import { withD1Busy } from "@/lib/d1Busy";
import { canSeeServer, proofFromRequest } from "@/lib/public-servers";

// Audit du 01/11 : sans ce contrôle, deviner le nom court d'un serveur privé suffisait à le suivre
// et à recevoir son nom dans les notifications. Serveur privé : il faut sa preuve (code d'invitation
// du serveur rejoint, ou propriétaire), sinon « introuvable », comme s'il n'existait pas.
const WATCH_COLUMNS = ["id", "playerCount", "isPrivate", "inviteCode"];
async function watchableServer(request: Request, slug: string) {
  const server = await db.orm.public.Server.select(...WATCH_COLUMNS)
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  if (!server || !(await canSeeServer(server, proofFromRequest(request)))) return null;
  return server;
}

// Lecture/écriture de la case "Me prévenir du changement de statut de cette instance" (point 9,
// voir INSTANCE_SETTINGS_FIELDS côté launcher) depuis la même petite fenêtre "Réglages" que le
// canal du modpack (/api/launcher/servers/[slug]/channel). Contrairement à cette dernière,
// PAS réservée au propriétaire (isProvenOwner) : le suivi s'applique à TOUTE instance de "Mes
// instances", possédée OU rejointe (confirmé explicitement) — n'importe quel joueur identifié
// peut donc activer son propre suivi sur n'importe quel serveur, d'où verifyLauncherIdentity
// (même contrôle que /api/launcher/notifications et /api/launcher/servers/mine) plutôt qu'une
// preuve de propriété.
async function handleGET(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/watch">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-watch", 60);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const minecraftUuid = searchParams.get("minecraftUuid");
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  const { slug } = await ctx.params;
  const server = await watchableServer(request, slug);
  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }

  const watch = await getInstanceWatch(minecraftUuid, server.id);
  return NextResponse.json({ notifyOnStatusChange: watch?.notifyOnStatusChange ?? false });
}

async function handlePATCH(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/watch">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Ecrit en base : meme palier que channel (10/min/adresse) — une case cochee/decochee
  // rarement, jamais en boucle.
  const limited = rateLimitResponse(request, "launcher-watch-write", 10);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) ?? {};
  const minecraftUuid = typeof body.minecraftUuid === "string" ? body.minecraftUuid : null;
  if (!minecraftUuid) {
    return NextResponse.json({ error: "minecraftUuid manquant" }, { status: 400 });
  }
  const identity = await verifyLauncherIdentity(request, minecraftUuid);
  if (identity !== "verified") return identityErrorResponse(identity);

  const { slug } = await ctx.params;
  const server = await watchableServer(request, slug);
  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }

  const notifyOnStatusChange = body.notifyOnStatusChange === true;
  // playerCount n'est non-null que si le dernier ping (recheck-reachability, ou une visite de
  // la fiche) a trouvé le serveur joignable — réutilisé ici plutôt qu'un ping en direct, pour ne
  // pas ralentir l'enregistrement d'un simple réglage (voir lib/instanceWatch.ts).
  await setInstanceWatch(minecraftUuid, server.id, notifyOnStatusChange, server.playerCount !== null);

  return NextResponse.json({ ok: true, notifyOnStatusChange });
}

export const GET = withD1Busy(handleGET);
export const PATCH = withD1Busy(handlePATCH);
