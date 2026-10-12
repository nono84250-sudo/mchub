import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/admin/design/guard";

export const dynamic = "force-dynamic";

export default async function PacksVide() {
  await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit), voir administration/page.tsx.
  redirect("/admin/servers");
}
