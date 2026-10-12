import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";

// Mise a jour (titre/texte/publie) depuis l'editeur (panel admin /admin/news/[id]).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/news/[id]">) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await ctx.params;
  const existing = await db.orm.public.News.select("id", "published", "publishedAt").where({ id }).first();
  if (!existing) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const body = String(form.get("body") ?? "").trim().slice(0, 20000);
  const published = form.get("published") === "on";
  if (!title || !body) return NextResponse.json({ error: "Titre et texte requis." }, { status: 400 });

  await db.orm.public.News.where({ id }).update({
    title,
    body,
    published,
    // Garde la premiere date de publication si deja publie ; en pose une si on publie maintenant.
    publishedAt: published ? (existing.publishedAt ?? new Date().toISOString()) : null,
  });
  return NextResponse.redirect(new URL("/admin/news", request.url), 303);
}
