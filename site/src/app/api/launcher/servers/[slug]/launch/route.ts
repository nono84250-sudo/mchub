import { NextResponse } from "next/server";
import { proofFromRequest, recordServerLaunch, visibleServerIdBySlug } from "@/lib/public-servers";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";

// Appelee par le launcher juste apres un lancement reussi (voir main.js) —
// meme secret partage que /api/launcher/servers/[slug], simple compteur
// indicatif pour la page de gestion du serveur.
export async function POST(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/launch">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launch", 60);
  if (limited) return limited;

  const { slug } = await ctx.params;
  if (!(await visibleServerIdBySlug(slug, proofFromRequest(request)))) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }
  await recordServerLaunch(slug);
  return NextResponse.json({ ok: true });
}
