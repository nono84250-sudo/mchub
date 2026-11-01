import { sourceDisabledResponse } from "@/lib/platformSettings";
import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest, launcherIdentityUuid } from "@/lib/launcherAuth";
import { CONTENT_CLASS_ID, CurseforgeForbiddenError, CurseforgeNotConfiguredError, searchCurseforgeContent } from "@/lib/curseforge";
import { requireLauncherFeature } from "@/lib/features";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { D1BusyError } from "@/lib/db";

// Page d'une installation du launcher (28/10, Laboratoire « contentCf ») : fenêtre « Ajouter »
// commune aux packs de ressources (rp), shaders (sh), mondes (w) et data packs (dp). Jamais de lien
// de téléchargement ici : le launcher le demande à /api/launcher/curseforge/files pour le fichier
// choisi, et seulement si son auteur le permet.
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const featureOff = await requireLauncherFeature(request, "contentCf");
  if (featureOff) return featureOff;
  const sourceOff = await sourceDisabledResponse("curseforge");
  if (sourceOff) return sourceOff;
  // Même frein que la recherche de mods : notre clé et son quota.
  const limited = rateLimitResponse(request, "launcher-curseforge-content", 30);
  if (limited) return limited;
  if (!(await launcherIdentityUuid(request))) {
    return NextResponse.json({ error: "Identité non vérifiée" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";
  if (!(kind in CONTENT_CLASS_ID)) return NextResponse.json({ error: "Type de contenu inconnu." }, { status: 400 });
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  try {
    const items = await searchCurseforgeContent(kind, q, { mc: url.searchParams.get("mc"), all: url.searchParams.get("all") === "1" });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof CurseforgeNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof CurseforgeForbiddenError) {
      return NextResponse.json({ error: error.message, code: "curseforge_forbidden" }, { status: 502 });
    }
    if (error instanceof D1BusyError) throw error;
    console.error("[launcher/curseforge/content]", error);
    return NextResponse.json({ error: "CurseForge n'a pas répondu correctement. Réessaie dans un instant.", code: "curseforge_error" }, { status: 502 });
  }
}

export const GET = withD1Busy(handleGET);
