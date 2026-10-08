import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { notificationsHtml } from "@/app/admin/design/bind";
import { getSiteBanner, getLauncherMaintenance } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";

export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const sentCount = params.sent ? Number.parseInt(params.sent, 10) || 0 : null;
  const [activeBanner, maintenance] = await Promise.all([getSiteBanner(), getLauncherMaintenance()]);
  return <DesignScreen name="notifications" html={notificationsHtml({ sentCount, activeBanner, maintenance })} />;
}
