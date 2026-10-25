import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { newsHtml, notificationsHtml } from "@/app/admin/design/bind";
import { getSiteBanner, getLauncherMaintenance, maintenancePhase } from "@/lib/platformSettings";
import { listPendingScheduledBroadcasts } from "@/lib/scheduledBroadcasts";

export const dynamic = "force-dynamic";

// 2026-10-12 : page desactivee (perimetre admin reduit) ; reactivee le 2026-10-25 a la demande
// de Rushi (mode maintenance du launcher). Les News y sont rangees en 2e onglet (?tab=news).
export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const news = await db.orm.public.News.select("id", "title", "published", "publishedAt", "createdAt")
    .orderBy((n) => n.createdAt.desc())
    .all();
  if (params.tab === "news") {
    return <DesignScreen name="notifications" html={newsHtml({ rows: news, saved: params.saved === "1" })} />;
  }
  const sentCount = params.sent ? Number.parseInt(params.sent, 10) || 0 : null;
  const scheduledConfirmed = params.scheduled === "1";
  const [activeBanner, maintenance, pendingScheduled] = await Promise.all([
    getSiteBanner(),
    getLauncherMaintenance(),
    listPendingScheduledBroadcasts(),
  ]);
  const maintenanceView = maintenance ? { ...maintenance, phase: maintenancePhase(maintenance) } : null;
  return (
    <DesignScreen
      name="notifications"
      html={notificationsHtml({ sentCount, scheduledConfirmed, activeBanner, maintenance: maintenanceView, pendingScheduled, newsCount: news.length })}
    />
  );
}
