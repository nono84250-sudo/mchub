import { sourceDisabledResponse } from "@/lib/platformSettings";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { SERVERS_CACHE_TAG, isVisibleRow, limitInviteAttempts, proofFromRequest } from "@/lib/public-servers";
import { CurseforgeForbiddenError, CurseforgeNotConfiguredError, getModpackInstallFile } from "@/lib/curseforge";
import { getModrinthModpackInstallFile } from "@/lib/modrinth";
import { getFtbModpackInstallFile } from "@/lib/ftb";
import { parseModpackSource } from "@/lib/modpack-types";

// Fichier du modpack d'un serveur moddé (CurseForge, Modrinth ou FTB), pour que le
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
  // Le bouton "Installer" (2026-10-11) marche sans connexion : l'identite
  // n'est donc plus exigee ici (elle l'etait depuis le "Point 3" de l'audit,
  // pour proteger le quota CurseForge de notre cle) — le frein par adresse
  // juste au-dessus reste la protection contre l'abus, meme sans identite.

  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select(
    "id",
    "type",
    "minecraftVersion",
    "curseforgeModpackId",
    "curseforgeModpackName",
    "curseforgeModpackVersion",
    "modpackSource",
    "modpackChannel",
    "published",
    "verificationStatus",
    "isPrivate",
    "inviteCode",
  )
    .include("owner", (o) => o.select("minecraftUuid"))
    .where({ slug })
    .first();
  // Meme garde complet que /api/launcher/servers/[slug] (voir isVisibleRow) : un serveur moddé
  // public mais pas encore publié/validé ne doit pas fuiter son modpack (audit 2026-10-10 §1.3).
  if (!server || !(await isVisibleRow(server, proofFromRequest(request)))) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }
  if (server.type !== "modded" || !server.curseforgeModpackId) {
    return NextResponse.json({ error: "Ce serveur n'a pas de modpack." }, { status: 404 });
  }
  // Interrupteur admin : une source coupée n'est plus servie (voir platformSettings.ts).
  const source = parseModpackSource(server.modpackSource);
  const sourceOff = await sourceDisabledResponse(source);
  if (sourceOff) return sourceOff;

  try {
    // Toujours la derniere version (jamais un numero fige, voir curseforge.ts/
    // modrinth.ts) : l'auteur du modpack peut la changer a tout moment, le
    // serveur doit suivre automatiquement, sans que son proprietaire n'ait a
    // revenir corriger quoi que ce soit dans ses parametres.
    // FTB (21/10) : pas d'archive, `ftb` donne le pack et la version dont le launcher lit lui-meme
    // la liste des fichiers (voir lib/ftb.ts). downloadUrl reste null : un ancien launcher qui ne
    // connait pas FTB s'arrete proprement sur « pas de lien de téléchargement ».
    const resolved =
      source === "modrinth"
        ? await getModrinthModpackInstallFile(server.curseforgeModpackId, { minecraftVersion: server.minecraftVersion }, server.modpackChannel)
        : source === "ftb"
          ? await getFtbModpackInstallFile(server.curseforgeModpackId, { minecraftVersion: server.minecraftVersion }, server.modpackChannel)
          : await getModpackInstallFile(server.curseforgeModpackId, { name: server.curseforgeModpackName }, server.modpackChannel);
    const { modpack, file } = resolved;

    // Met a jour l'affichage (fiche publique, Parametres) avec la version
    // reellement resolue, seulement quand elle a change — evite une ecriture
    // en base a chaque lancement alors que rien n'a bouge la plupart du temps.
    if (file.displayName !== server.curseforgeModpackVersion) {
      await db.orm.public.Server.where({ id: server.id }).update({ curseforgeModpackVersion: file.displayName });
      revalidateTag(SERVERS_CACHE_TAG, { expire: 0 });
    }

    return NextResponse.json({
      source,
      modpack,
      file,
      minecraftVersion: server.minecraftVersion,
      ...("ftb" in resolved ? { ftb: resolved.ftb } : {}),
    });
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
