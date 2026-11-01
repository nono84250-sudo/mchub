import { sourceDisabledResponse } from "@/lib/platformSettings";
import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest, launcherIdentityUuid } from "@/lib/launcherAuth";
import { CurseforgeForbiddenError, CurseforgeNotConfiguredError, searchCurseforgeMods } from "@/lib/curseforge";
import { requireLauncherFeature } from "@/lib/features";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { D1BusyError } from "@/lib/db";

const LOADERS = new Set(["forge", "neoforge", "fabric", "quilt"]);

// « Mon pack » du launcher (26/10, Laboratoire « myPackCf ») : chercher un mod sur CurseForge.
// Renvoie le nom, l'auteur et la page du fichier conseillé ; jamais de lien de téléchargement :
// le joueur télécharge lui-même depuis la page (voir launcher/src/main.js, myPack:openCurseForge).
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const featureOff = await requireLauncherFeature(request, "myPackCf");
  if (featureOff) return featureOff;
  const sourceOff = await sourceDisabledResponse("curseforge");
  if (sourceOff) return sourceOff;
  // Même frein que la route des fichiers : notre clé et son quota.
  const limited = rateLimitResponse(request, "launcher-curseforge-mods", 30);
  if (limited) return limited;
  if (!(await launcherIdentityUuid(request))) {
    return NextResponse.json({ error: "Identité non vérifiée" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const loader = url.searchParams.get("loader");
  try {
    // all=1 (menus d'ajout, 31/10) : aussi ce qui n'existe pas pour cette version, avec ses versions.
    const mods = await searchCurseforgeMods(q, { mc: url.searchParams.get("mc"), loader: loader && LOADERS.has(loader) ? loader : null, all: url.searchParams.get("all") === "1" });
    return NextResponse.json({ mods });
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof CurseforgeForbiddenError) {
      return NextResponse.json({ error: error.message, code: "curseforge_forbidden" }, { status: 502 });
    }
    if (error instanceof D1BusyError) throw error;
    console.error("[launcher/curseforge/mods]", error);
    return NextResponse.json({ error: "CurseForge n'a pas répondu correctement. Réessaie dans un instant.", code: "curseforge_error" }, { status: 502 });
  }
}

export const GET = withD1Busy(handleGET);
