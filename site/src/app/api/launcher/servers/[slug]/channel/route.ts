import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { SERVERS_CACHE_TAG, isProvenOwner, proofFromRequest } from "@/lib/public-servers";
import type { ModpackChannel } from "@/lib/modpack-types";
import { withD1Busy } from "@/lib/d1Busy";

// Lecture/ecriture du canal de suivi du modpack (release/beta, voir server.modpackChannel et
// ModpackPicker.tsx cote site) depuis la petite fenetre "Reglages" d'une instance (Mes
// instances, launcher) — NOUVEAU bouton distinct de "Gerer" (servers:openManage, qui ouvre
// toujours le site dans le navigateur et n'est pas touche ici). Reservee au PROPRIETAIRE du
// serveur, meme preuve que /self-test (jeton Mojang ou session de lanceur, voir isProvenOwner) :
// un joueur qui a juste rejoint ne doit pas pouvoir changer la configuration d'un serveur qui
// n'est pas le sien.
async function handleGET(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/channel">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-channel", 60);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select("id", "type", "modpackChannel")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }
  if (!(await isProvenOwner(server.owner, proofFromRequest(request)))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  return NextResponse.json({ modpackChannel: server.modpackChannel, type: server.type });
}

async function handlePATCH(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/channel">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Ecrit en base : meme palier que self-test (10/min/adresse) — un proprietaire legitime ne
  // change ce reglage que rarement, jamais en boucle.
  const limited = rateLimitResponse(request, "launcher-channel-write", 10);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select("id", "type", "modpackChannel", "modpackSource")
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }
  if (!(await isProvenOwner(server.owner, proofFromRequest(request)))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  if (server.type !== "modded") {
    return NextResponse.json({ error: "Ce serveur n'a pas de modpack." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) ?? {};
  const modpackChannel: ModpackChannel = body.modpackChannel === "beta" ? "beta" : "release";
  if (modpackChannel === server.modpackChannel) {
    return NextResponse.json({ ok: true, modpackChannel });
  }

  await db.orm.public.Server.where({ id: server.id }).update({ modpackChannel });
  // Le prochain /api/launcher/servers/[slug]/modpack doit resoudre le fichier avec le nouveau
  // canal tout de suite (voir modpack/route.ts) : la fiche publique/Parametres doivent aussi
  // refleter le changement sans attendre jusqu'a 60s (SERVERS_CACHE_TAG).
  revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, modpackChannel });
}

export const GET = withD1Busy(handleGET);
export const PATCH = withD1Busy(handlePATCH);
