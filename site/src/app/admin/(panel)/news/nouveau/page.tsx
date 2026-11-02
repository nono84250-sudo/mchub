import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { newsEditorHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

export default async function NewsEditor() {
  await requireAdmin();
  // 2026-10-12 : desactivee ; reactivee le 25/10 (les News sont l'onglet « Actualités » de Notifications).
  const html = newsEditorHtml({ id: null, title: "", body: "", published: false });
  return <DesignScreen name="news-editor" html={html} />;
}
