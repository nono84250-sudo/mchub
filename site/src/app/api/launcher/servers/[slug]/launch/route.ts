import { NextResponse } from "next/server";
import { recordServerLaunch } from "@/lib/public-servers";

// Appelee par le launcher juste apres un lancement reussi (voir main.js) —
// meme secret partage que /api/launcher/servers/[slug], simple compteur
// indicatif pour la page de gestion du serveur.
export async function POST(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]/launch">) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.LAUNCHER_API_KEY}`;

  if (!process.env.LAUNCHER_API_KEY || authHeader !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  await recordServerLaunch(slug);
  return NextResponse.json({ ok: true });
}
