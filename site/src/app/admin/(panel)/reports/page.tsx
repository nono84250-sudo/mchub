import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { reportsHtml, type BehaviorReportDetail } from "@/app/admin/design/bind";
import { listBehaviorReports, getBehaviorReportDetail } from "@/lib/reports";

export const dynamic = "force-dynamic";

// 2026-10-13 : réactivée (retirée du périmètre réduit du 2026-10-12 sans faire exprès,
// signalé par l'utilisateur) — nécessaire pour construire le process de recours (point 4 de
// la checklist), qui réutilisera ce même système de Reports avec une nouvelle catégorie.
export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status === "resolved" ? "resolved" : "open";

  const [openReports, resolvedReports] = await Promise.all([listBehaviorReports("open"), listBehaviorReports("resolved")]);
  const reports = status === "open" ? openReports : resolvedReports;

  let selected: BehaviorReportDetail | null = null;
  if (params.reportId) {
    const found = await getBehaviorReportDetail(params.reportId);
    if (found?.server) {
      selected = {
        ...found.report,
        serverName: found.server.name,
        serverSlug: found.server.slug,
        ownerId: found.server.ownerId,
        ownerName: found.server.owner?.name ?? "—",
        ownerMinecraftUuid: found.server.owner?.minecraftUuid ?? null,
      };
    }
  }

  return (
    <DesignScreen
      name="reports"
      html={reportsHtml({ status, openCount: openReports.length, resolvedCount: resolvedReports.length, reports, selected })}
    />
  );
}
