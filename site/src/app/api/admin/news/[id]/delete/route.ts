import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";
import { removeNewsNotifications } from "@/lib/newsNotify";

// Suppression definitive (depuis la liste ou l'editeur).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/news/[id]/delete">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const article = await db.orm.public.News.select("id").where({ id }).first();
  if (!article) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
  await db.orm.public.News.where({ id }).delete();
  await removeNewsNotifications(id);
  return NextResponse.redirect(new URL("/admin/notifications?tab=news&saved=1", request.url), 303);
}
