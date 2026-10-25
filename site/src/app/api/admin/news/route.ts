import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminForAction } from "@/lib/adminServers";
import { notifyNewsPublished } from "@/lib/newsNotify";

// Creation d'un article (panel admin /admin/news/nouveau).
export async function POST(request: Request) {
  const admin = await adminForAction(request);
  if (admin instanceof NextResponse) return admin;
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const body = String(form.get("body") ?? "").trim().slice(0, 20000);
  const published = form.get("published") === "on";
  if (!title || !body) return NextResponse.json({ error: "Titre et texte requis." }, { status: 400 });

  const created = await db.orm.public.News.create({
    title,
    body,
    published,
    publishedAt: published ? new Date().toISOString() : null,
  });
  if (published && form.get("notify") === "on") await notifyNewsPublished(String(created.id), title);
  return NextResponse.redirect(new URL("/admin/notifications?tab=news&saved=1", request.url), 303);
}
