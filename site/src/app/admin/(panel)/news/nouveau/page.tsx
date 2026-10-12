import { redirect } from "next/navigation";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { newsEditorHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

export default async function NewsEditor() {
  await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit), voir administration/page.tsx.
  redirect("/admin/servers");
  const html = newsEditorHtml({ id: null, title: "", body: "", published: false });
  return <DesignScreen name="news-editor" html={html} />;
}
