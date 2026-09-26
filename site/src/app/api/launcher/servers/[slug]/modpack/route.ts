import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { db } from "@/prisma/db";
import { CurseforgeForbiddenError, CurseforgeNotConfiguredError, getModpackInstallFile } from "@/lib/curseforge";
import { getModrinthModpackInstallFile } from "@/lib/modrinth";

// Fichier du modpack d'un serveur moddé (CurseForge ou Modrinth), pour que le
// launcher l'installe (voir launcher/src/modpack.js). La cle CurseForge reste
// ici : le launcher ne recoit que le lien de telechargement du fichier.
export async function GET(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/modpack">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select(
    "type",
    "minecraftVersion",
    "curseforgeModpackId",
    "curseforgeModpackName",
    "curseforgeModpackVersion",
    "modpackSource",
  )
    .where({ slug })
    .first();
  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }
  if (server.type !== "modded" || !server.curseforgeModpackId) {
    return NextResponse.json({ error: "Ce serveur n'a pas de modpack." }, { status: 404 });
  }

  try {
    const { modpack, file } =
      server.modpackSource === "modrinth"
        ? await getModrinthModpackInstallFile(server.curseforgeModpackId, {
            version: server.curseforgeModpackVersion,
            minecraftVersion: server.minecraftVersion,
          })
        : await getModpackInstallFile(server.curseforgeModpackId, {
            name: server.curseforgeModpackName,
            version: server.curseforgeModpackVersion,
          });
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
