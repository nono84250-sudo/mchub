import { NextResponse } from "next/server";
import { withD1Busy } from "@/lib/d1Busy";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { requireLauncherFeature } from "@/lib/features";
import { bugCatalogVersion, listPublicBugs } from "@/lib/bugCatalog";

// Catalogue de bugs (31/10, Laboratoire « bugCatalog ») : les fiches publiées pour les joueurs.
// Le launcher les demande au démarrage puis toutes les 10 minutes, avec l'ETag de sa dernière
// réponse : rien n'est retéléchargé tant qu'aucune fiche ne change.
async function handleGET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const limited = rateLimitResponse(request, "launcher-bugs", 30);
  if (limited) return limited;
  const off = await requireLauncherFeature(request, "bugCatalog");
  if (off) return off;
  const entries = await listPublicBugs();
  const etag = `"${bugCatalogVersion(entries)}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-store" };
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  // L'extrait de journal ne sert qu'à la page du site et à l'admin.
  return NextResponse.json({ entries: entries.map((entry) => ({ ...entry, logSample: undefined })) }, { headers });
}

export const GET = withD1Busy(handleGET);
