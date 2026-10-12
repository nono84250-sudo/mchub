import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { newsHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

export default async function News() {
  await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit), voir administration/page.tsx.
  redirect("/admin/servers");
  const rows = await db.orm.public.News.select("id", "title", "published", "publishedAt", "createdAt")
    .orderBy((n) => n.createdAt.desc())
    .all();
  const html = newsHtml({ rows });
  return <DesignScreen name="news" html={html} />;
}
