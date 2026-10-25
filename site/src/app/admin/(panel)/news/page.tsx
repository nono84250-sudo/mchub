import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/admin/design/guard";

export const dynamic = "force-dynamic";

// 25/10 : les News sont maintenant l'onglet « Actualités » du panneau Notifications.
export default async function News() {
  await requireAdmin();
  redirect("/admin/notifications?tab=news");
}
