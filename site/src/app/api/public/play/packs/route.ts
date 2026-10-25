import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/db";
import { getPlayBeta, listPublishedPacks } from "@/lib/playWorlds";

// Mode Jouer (bêta, 24/10) : packs officiels publiés (listes de mods Modrinth, rien n'est hébergé
// chez nous) + le réglage central du badge « Bêta » (beta), lu par le launcher pour son menu.
// Même liste pour tout le monde : mise en cache par le CDN 60 s.
export const GET = withD1Busy(async (request: Request) => {
  const limited = rateLimitResponse(request, "public-play-packs", 60);
  if (limited) return limited;
  const [beta, packs] = await Promise.all([getPlayBeta(), listPublishedPacks()]);
  return NextResponse.json({ beta, packs }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
});
