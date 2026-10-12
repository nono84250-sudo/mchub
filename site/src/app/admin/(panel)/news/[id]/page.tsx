import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { newsEditorHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

export default async function NewsEdit({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit), voir administration/page.tsx.
  redirect("/admin/servers");
  const { id } = await params;
  const article = await db.orm.public.News.select("id", "title", "body", "published").where({ id }).first();
  if (!article) notFound();
  const html = newsEditorHtml({ id: article.id, title: article.title, body: article.body, published: article.published });
  return <DesignScreen name="news-editor" html={html} />;
}
