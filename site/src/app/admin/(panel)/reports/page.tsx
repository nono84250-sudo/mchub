import { redirect } from "next/navigation";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { reportsHtml, type BehaviorReportDetail } from "@/app/admin/design/bind";
import { listBehaviorReports, getBehaviorReportDetail } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function Reports() {
  await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit), voir
  // administration/page.tsx. Logique d'origine conservee ci-dessous (ReportsOriginal, non
  // utilisee) pour reactivation future sans tout reecrire.
  redirect("/admin/servers");
}

async function ReportsOriginal({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
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
