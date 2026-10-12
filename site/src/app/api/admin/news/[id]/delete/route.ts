import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Suppression definitive (depuis la liste ou l'editeur).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/news/[id]/delete">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const article = await db.orm.public.News.select("id").where({ id }).first();
  if (!article) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
  await db.orm.public.News.where({ id }).delete();
  return NextResponse.redirect(new URL("/admin/news", request.url), 303);
}
