import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";
import { getPlayBeta, listPublishedPacks } from "@/lib/playWorlds";
import { requireLauncherFeature, withLauncherFeature } from "@/lib/features";

// Mode Jouer (bêta, 24/10) : packs officiels publiés (listes de mods Modrinth, rien n'est hébergé
// chez nous) + le réglage central du badge « Bêta » (beta), lu par le launcher pour son menu.
// Laboratoire (25/10) : 404 tant que le mode Jouer est caché pour ce launcher. La réponse dépend
// alors de qui demande : plus de cache partagé par le CDN.
export const GET = withD1Busy(withLauncherFeature("play", async (request: Request) => {
  const limited = rateLimitResponse(request, "public-play-packs", 60);
  if (limited) return limited;
  const [beta, all, omniOff] = await Promise.all([getPlayBeta(), listPublishedPacks(), requireLauncherFeature(request, "omniPack")]);
  // Pack Omniscient (27/10) : les packs 'omni' seulement si l'interrupteur est visible pour ce joueur.
  const packs = omniOff ? all.filter((p) => p.kind !== "omni") : all;
  return NextResponse.json({ beta, packs }, { headers: { "Cache-Control": "private, max-age=60" } });
}));
