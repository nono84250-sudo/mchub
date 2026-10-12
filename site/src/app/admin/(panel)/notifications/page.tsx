import { redirect } from "next/navigation";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { notificationsHtml } from "@/app/admin/design/bind";
import { getSiteBanner, getLauncherMaintenance } from "@/lib/platformSettings";
import { listPendingScheduledBroadcasts } from "@/lib/scheduledBroadcasts";

export const dynamic = "force-dynamic";

export default async function Notifications() {
  await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit), voir
  // administration/page.tsx. Logique d'origine conservee ci-dessous (NotificationsOriginal,
  // non utilisee) pour reactivation future sans tout reecrire.
  redirect("/admin/servers");
}

async function NotificationsOriginal({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const sentCount = params.sent ? Number.parseInt(params.sent, 10) || 0 : null;
  const scheduledConfirmed = params.scheduled === "1";
  const [activeBanner, maintenance, pendingScheduled] = await Promise.all([
    getSiteBanner(),
    getLauncherMaintenance(),
    listPendingScheduledBroadcasts(),
  ]);
  return <DesignScreen name="notifications" html={notificationsHtml({ sentCount, scheduledConfirmed, activeBanner, maintenance, pendingScheduled })} />;
}
