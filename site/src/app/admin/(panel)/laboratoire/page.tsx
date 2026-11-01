import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminFeatureLab } from "@/components/admin/AdminFeatureLab";
import { requireAdmin } from "@/app/admin/design/guard";
import { getLabForAdmin } from "@/lib/features";

export const dynamic = "force-dynamic";
export const metadata = { title: "Laboratoire — Omniscient" };

// 2026-10-25 : Laboratoire (preview validée par Rushi). Un interrupteur à 5 états par
// fonctionnalité (cachée, test, bêta testeurs, bêta publique, pour tous), lu par le site et
// par le launcher (/api/launcher/features). Les états vivent dans platformSetting, voir
// lib/features.ts ; l'enregistrement passe par /api/admin/features.
export default async function Laboratoire() {
  await requireAdmin();
  const lab = await getLabForAdmin();
  return (
    <AdminChrome active="laboratoire">
      <AdminFeatureLab initial={lab} />
    </AdminChrome>
  );
}
