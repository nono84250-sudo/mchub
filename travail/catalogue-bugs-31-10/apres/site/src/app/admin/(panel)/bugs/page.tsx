import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminBugCatalog } from "@/components/admin/AdminBugCatalog";
import { requireAdmin } from "@/app/admin/design/guard";
import { listBugsForAdmin } from "@/lib/bugCatalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bugs — Omniscient" };

// 31/10 : catalogue de bugs (preview validée par Rushi). Chaque bug réglé devient une fiche, lue par
// le launcher (/api/launcher/bugs) et par la page publique /aide/bugs. Voir lib/bugCatalog.ts.
// Tables absentes (migration 2026-10-31-catalogue-bugs.sql pas encore passée) : on le dit dans la page.
export default async function BugsPage() {
  await requireAdmin();
  const entries = await listBugsForAdmin().catch(() => null);
  return (
    <AdminChrome active="bugs">
      <AdminBugCatalog initial={entries ?? []} missingTables={entries === null} />
    </AdminChrome>
  );
}
