import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/prisma/db";
import { SERVERS_CACHE_TAG, canSeeServer, limitInviteAttempts, proofFromRequest } from "@/lib/public-servers";
import { CurseforgeForbiddenError, CurseforgeNotConfiguredError, getModpackInstallFile } from "@/lib/curseforge";
import { getModrinthModpackInstallFile } from "@/lib/modrinth";

// Fichier du modpack d'un serveur moddé (CurseForge ou Modrinth), pour que le
// launcher l'installe (voir launcher/src/modpack.js). La cle CurseForge reste
// ici : le launcher ne recoit que le lien de telechargement du fichier.
export async function GET(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/modpack">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Chaque appel interroge CurseForge/Modrinth avec notre cle : frein par adresse,
  // plus un frein renforce quand une preuve (code d'invitation) est presentee.
  const limited = rateLimitResponse(request, "launcher-modpack", 60) ?? limitInviteAttempts(request);
  if (limited) return limited;

  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select(
    "id",
    "type",
    "minecraftVersion",
    "curseforgeModpackId",
    "curseforgeModpackName",
    "curseforgeModpackVersion",
    "modpackSource",
    "isPrivate",
    "inviteCode",
  )
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  // Serveur prive : meme preuve que /api/launcher/servers/[slug] (voir canSeeServer).
  if (!server || !(await canSeeServer(server, proofFromRequest(request)))) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }
  if (server.type !== "modded" || !server.curseforgeModpackId) {
    return NextResponse.json({ error: "Ce serveur n'a pas de modpack." }, { status: 404 });
  }

  try {
    // Toujours la derniere version (jamais un numero fige, voir curseforge.ts/
    // modrinth.ts) : l'auteur du modpack peut la changer a tout moment, le
    // serveur doit suivre automatiquement, sans que son proprietaire n'ait a
    // revenir corriger quoi que ce soit dans ses parametres.
    const { modpack, file } =
      server.modpackSource === "modrinth"
        ? await getModrinthModpackInstallFile(server.curseforgeModpackId, { minecraftVersion: server.minecraftVersion })
        : await getModpackInstallFile(server.curseforgeModpackId, { name: server.curseforgeModpackName });

    // Met a jour l'affichage (fiche publique, Parametres) avec la version
    // reellement resolue, seulement quand elle a change — evite une ecriture
    // en base a chaque lancement alors que rien n'a bouge la plupart du temps.
    if (file.displayName !== server.curseforgeModpackVersion) {
      await db.orm.public.Server.where({ id: server.id }).update({ curseforgeModpackVersion: file.displayName });
      revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });
    }

    return NextResponse.json({ source: server.modpackSource, modpack, file, minecraftVersion: server.minecraftVersion });
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof CurseforgeForbiddenError) {
      return NextResponse.json({ error: error.message, code: "curseforge_forbidden" }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message, code: "modpack_source_error" }, { status: 502 });
  }
}
