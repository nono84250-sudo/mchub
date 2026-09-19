import { NextResponse } from "next/server";
import { recordServerView } from "@/lib/public-servers";

// Compteur de vues indicatif (page de gestion du serveur) — appele depuis
// ViewTracker au chargement de la fiche publique. Pas d'auth : la fiche
// elle-meme est publique, ce n'est qu'un compteur, pas une donnee sensible.
export async function POST(_request: Request, ctx: RouteContext<"/api/public/servers/[slug]/view">) {
  const { slug } = await ctx.params;
  await recordServerView(slug);
  return NextResponse.json({ ok: true });
}
