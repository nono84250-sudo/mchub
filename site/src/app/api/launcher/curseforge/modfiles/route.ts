import { sourceDisabledResponse } from "@/lib/platformSettings";
import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest, launcherIdentityUuid } from "@/lib/launcherAuth";
import { CurseforgeForbiddenError, CurseforgeNotConfiguredError, listCurseforgeModFiles } from "@/lib/curseforge";
import { requireLauncherFeature } from "@/lib/features";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { D1BusyError } from "@/lib/db";

const LOADERS = new Set(["forge", "neoforge", "fabric", "quilt"]);

// « Corriger le pack » du launcher (30/10) : fichiers d'un mod CurseForge pour une version de
// Minecraft et un chargeur, avec la page exacte de chaque fichier. Jamais de lien de téléchargement.
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Mon pack (myPackCf) ou pack CurseForge importé (cfImport).
  if (await requireLauncherFeature(request, "myPackCf")) {
    const featureOff = await requireLauncherFeature(request, "cfImport");
    if (featureOff) return featureOff;
  }
  const sourceOff = await sourceDisabledResponse("curseforge");
  if (sourceOff) return sourceOff;
  const limited = rateLimitResponse(request, "launcher-curseforge-modfiles", 30);
  if (limited) return limited;
  if (!(await launcherIdentityUuid(request))) {
    return NextResponse.json({ error: "Identité non vérifiée" }, { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return NextResponse.json({ error: "Mod CurseForge inconnu." }, { status: 400 });
  }
  const loader = url.searchParams.get("loader");
  try {
    const files = await listCurseforgeModFiles(projectId, { mc: url.searchParams.get("mc"), loader: loader && LOADERS.has(loader) ? loader : null });
    return NextResponse.json({ files });
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof CurseforgeForbiddenError) {
      return NextResponse.json({ error: error.message, code: "curseforge_forbidden" }, { status: 502 });
    }
    if (error instanceof D1BusyError) throw error;
    console.error("[launcher/curseforge/modfiles]", error);
    return NextResponse.json({ error: "CurseForge n'a pas répondu correctement. Réessaie dans un instant.", code: "curseforge_error" }, { status: 502 });
  }
}

export const GET = withD1Busy(handleGET);
