import { sourceDisabledResponse } from "@/lib/platformSettings";
import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest, launcherIdentityUuid } from "@/lib/launcherAuth";
import { browseCurseforgeModpacks, CurseforgeForbiddenError, CurseforgeNotConfiguredError, getModpackInstallFile } from "@/lib/curseforge";
import { requireLauncherFeature } from "@/lib/features";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { D1BusyError } from "@/lib/db";

const LOADERS = new Set(["forge", "neoforge", "fabric", "quilt"]);

// « Un pack existant » du launcher (28/10, Laboratoire « packBrowse ») :
// - ?q=… (mc, loader) : modpacks CurseForge, les plus populaires d'abord ;
// - ?id=… (name) : fichier .zip du pack à installer (dernière version stable). Jamais de lien si
//   l'auteur interdit les autres launchers : le joueur passe alors par la page CurseForge.
// Les mods du pack ne passent jamais par ici (route /api/launcher/curseforge/files, mods bloqués
// à prendre à la main).
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const featureOff = await requireLauncherFeature(request, "packBrowse");
  if (featureOff) return featureOff;
  const sourceOff = await sourceDisabledResponse("curseforge");
  if (sourceOff) return sourceOff;
  const limited = rateLimitResponse(request, "launcher-curseforge-modpacks", 30);
  if (limited) return limited;
  if (!(await launcherIdentityUuid(request))) {
    return NextResponse.json({ error: "Identité non vérifiée" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    if (id) {
      if (!/^\d{1,10}$/.test(id)) return NextResponse.json({ error: "Pack invalide." }, { status: 400 });
      const name = (url.searchParams.get("name") ?? "").slice(0, 80) || null;
      try {
        const { modpack, file } = await getModpackInstallFile(id, { name });
        return NextResponse.json({ modpack, file: { id: file.id, displayName: file.displayName, fileName: file.fileName, downloadUrl: file.downloadUrl, fileLength: file.fileLength, sha1: file.sha1 } });
      } catch (error) {
        if (error instanceof CurseforgeNotConfiguredError || error instanceof CurseforgeForbiddenError || error instanceof D1BusyError) throw error;
        return NextResponse.json({ error: error instanceof Error ? error.message : "Fichier introuvable.", code: "no_download" }, { status: 404 });
      }
    }
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const loader = url.searchParams.get("loader");
    const packs = await browseCurseforgeModpacks(q, { mc: url.searchParams.get("mc"), loader: loader && LOADERS.has(loader) ? loader : null });
    return NextResponse.json({ packs });
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof CurseforgeForbiddenError) {
      return NextResponse.json({ error: error.message, code: "curseforge_forbidden" }, { status: 502 });
    }
    if (error instanceof D1BusyError) throw error;
    console.error("[launcher/curseforge/modpacks]", error);
    return NextResponse.json({ error: "CurseForge n'a pas répondu correctement. Réessaie dans un instant.", code: "curseforge_error" }, { status: 502 });
  }
}

export const GET = withD1Busy(handleGET);
