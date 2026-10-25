import { NextResponse } from "next/server";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { getServerOfTheDay } from "@/lib/public-servers";
import { teamsPublic, withoutTeam } from "@/lib/features";
import { rateLimitResponse } from "@/lib/rateLimit";

// « Petit serveur du jour » (19/10) : le launcher lit ici le choix du SITE pour sa colonne
// « À la une », au lieu de choisir lui-meme. Meme choix que l'accueil du site, pour toute la
// journee (heure de Bruxelles). `server` vaut null quand aucun petit serveur actif n'est eligible :
// le launcher cache alors la colonne. Choix automatique et gratuit, jamais payant.
export async function GET(request: Request) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-featured", 60);
  if (limited) return limited;

  const pick = await getServerOfTheDay();
  return NextResponse.json(
    pick
      ? { day: pick.day, automatic: true, server: (await teamsPublic()) ? pick.server : withoutTeam(pick.server), launches7d: pick.launches7d, fillPercent: pick.fillPercent }
      : { day: null, automatic: true, server: null },
  );
}
