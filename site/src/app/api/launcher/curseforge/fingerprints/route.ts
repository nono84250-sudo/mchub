import { sourceDisabledResponse } from "@/lib/platformSettings";
import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest, launcherIdentityUuid } from "@/lib/launcherAuth";
import { CurseforgeForbiddenError, CurseforgeNotConfiguredError, matchCurseforgeFingerprints } from "@/lib/curseforge";
import { requireLauncherFeature } from "@/lib/features";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { D1BusyError } from "@/lib/db";

const MAX_FINGERPRINTS = 500;

// « Exporter pour un ami » en .zip CurseForge (31/10, Laboratoire « addMenus ») : le launcher envoie
// l'empreinte de chaque .jar du pack ; on répond quel projet et quel fichier CurseForge c'est. Le .zip
// garde alors un lien CurseForge au lieu du fichier. Rien n'est gardé ici.
async function handlePOST(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const featureOff = await requireLauncherFeature(request, "addMenus");
  if (featureOff) return featureOff;
  const sourceOff = await sourceDisabledResponse("curseforge");
  if (sourceOff) return sourceOff;
  const limited = rateLimitResponse(request, "launcher-curseforge-fingerprints", 10);
  if (limited) return limited;
  if (!(await launcherIdentityUuid(request))) {
    return NextResponse.json({ error: "Identité non vérifiée" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const list: unknown = body?.fingerprints;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_FINGERPRINTS || !list.every((x) => Number.isInteger(x) && x >= 0 && x <= 0xffffffff)) {
    return NextResponse.json({ error: `fingerprints doit être une liste de 1 à ${MAX_FINGERPRINTS} entiers` }, { status: 400 });
  }
  try {
    const matches = await matchCurseforgeFingerprints(list as number[]);
    return NextResponse.json({ matches });
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof CurseforgeForbiddenError) {
      return NextResponse.json({ error: error.message, code: "curseforge_forbidden" }, { status: 502 });
    }
    if (error instanceof D1BusyError) throw error;
    console.error("[launcher/curseforge/fingerprints]", error);
    return NextResponse.json({ error: "CurseForge n'a pas répondu correctement. Réessaie dans un instant.", code: "curseforge_error" }, { status: 502 });
  }
}

export const POST = withD1Busy(handlePOST);
