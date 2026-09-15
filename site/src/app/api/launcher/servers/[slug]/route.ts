import { NextResponse } from "next/server";
import { db } from "@/prisma/db";

// Route reservee au launcher (jamais au site public) : c'est la SEULE
// route qui renvoie l'IP d'un serveur. Protegee par un secret partage
// (LAUNCHER_API_KEY), connu uniquement du code du launcher — pas par
// l'identite du joueur (le launcher gere sa propre auth Microsoft
// separement). Voir cahier des charges : deterrent, pas garantie absolue
// (un joueur qui a deja rejoint connait ensuite l'IP).
export async function GET(request: Request, ctx: RouteContext<"/api/launcher/servers/[slug]">) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.LAUNCHER_API_KEY}`;

  if (!process.env.LAUNCHER_API_KEY || authHeader !== expected) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  const server = await db.orm.public.Server.select(
    "name",
    "type",
    "ip",
    "minecraftVersion",
    "curseforgeModpackId",
  )
    .where({ slug })
    .first();

  if (!server) {
    return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });
  }

  return NextResponse.json({ server });
}
