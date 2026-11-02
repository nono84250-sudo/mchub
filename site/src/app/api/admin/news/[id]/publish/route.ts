import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";
import { notifyNewsPublished } from "@/lib/newsNotify";

// Bascule rapide depuis la liste (onglet Actualites de /admin/notifications) : publie sans ouvrir
// l'editeur. 25/10 : previent aussi les joueurs (launcher et site), une seule fois par article.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/news/[id]/publish">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const article = await db.orm.public.News.select("id", "title", "published", "publishedAt").where({ id }).first();
  if (!article) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
  await db.orm.public.News.where({ id }).update({ published: true, publishedAt: article.publishedAt ?? new Date().toISOString() });
  if (!article.published) await notifyNewsPublished(id, String(article.title));
  return NextResponse.redirect(new URL("/admin/notifications?tab=news&saved=1", request.url), 303);
}
