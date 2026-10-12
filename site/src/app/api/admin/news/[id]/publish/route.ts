import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Bascule rapide depuis la liste (panel admin /admin/news) : publie sans ouvrir l'editeur.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/news/[id]/publish">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const article = await db.orm.public.News.select("id", "publishedAt").where({ id }).first();
  if (!article) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
  await db.orm.public.News.where({ id }).update({ published: true, publishedAt: article.publishedAt ?? new Date().toISOString() });
  return NextResponse.redirect(new URL("/admin/news", request.url), 303);
}
