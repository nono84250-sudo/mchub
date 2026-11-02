import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedLauncherRequest } from "@/lib/launcherAuth";
import { rateLimitResponse } from "@/lib/rateLimit";
import { withD1Busy } from "@/lib/d1Busy";

// Article complet pour le centre de notifications du launcher (25/10) : une notification
// « news:<id> » (voir lib/newsNotify.ts) s'ouvre dans le panneau. Seulement un article publie,
// le meme texte que la page Actualites du tableau de bord.
async function handleGET(request: Request, ctx: RouteContext<"/api/launcher/news/[id]">) {
  if (!isAuthorizedLauncherRequest(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const limited = rateLimitResponse(request, "launcher-news", 120);
  if (limited) return limited;

  const { id } = await ctx.params;
  const post = await db.orm.public.News.select("id", "title", "body", "publishedAt").where({ id, published: true }).first();
  if (!post) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
  return NextResponse.json({ news: { id: post.id, title: post.title, body: post.body, publishedAt: post.publishedAt } });
}

export const GET = withD1Busy(handleGET);
