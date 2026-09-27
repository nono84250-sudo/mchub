import { NextResponse } from "next/server";
import { recordServerView } from "@/lib/public-servers";
import { rateLimitResponse } from "@/lib/rateLimit";

// Compteur de vues indicatif (page de gestion du serveur) — appele depuis
// ViewTracker au chargement de la fiche publique. Pas d'auth : la fiche
// elle-meme est publique, ce n'est qu'un compteur, pas une donnee sensible.
export async function POST(request: Request, ctx: RouteContext<"/api/public/servers/[slug]/view">) {
  // Ouverte a tous et ecrit en base : une seule source ne peut pas gonfler le compteur ni charger la base.
  const limited = rateLimitResponse(request, "view", 30);
  if (limited) return limited;

  const { slug } = await ctx.params;
  await recordServerView(slug);
  return NextResponse.json({ ok: true });
}
