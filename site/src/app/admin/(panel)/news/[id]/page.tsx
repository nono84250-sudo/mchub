import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { newsEditorHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

export default async function NewsEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  // 2026-10-12 : desactivee ; reactivee le 25/10 (les News sont l'onglet « Actualités » de Notifications).
  const { id } = await params;
  const article = await db.orm.public.News.select("id", "title", "body", "published").where({ id }).first();
  if (!article) notFound();
  const html = newsEditorHtml({ id: article.id, title: article.title, body: article.body, published: article.published });
  return <DesignScreen name="news-editor" html={html} />;
}
