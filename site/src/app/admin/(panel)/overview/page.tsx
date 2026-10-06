import { db } from "@/prisma/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { overviewHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

export default async function Overview() {
  await requireAdmin();
  const [servers, openReports] = await Promise.all([
    db.orm.public.Server.select("id").all(),
    db.orm.public.Report.select("id", "issue", "reporterMinecraftUsername", "createdAt", "serverId")
      .where({ status: "new" })
      .orderBy((r) => r.createdAt.desc())
      .include("server", (s) => s.select("name"))
      .all(),
  ]);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const ago = (date: Date) => {
    const h = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
    return h < 24 ? `${Math.max(1, h)} h ago` : `${Math.floor(h / 24)} d ago`;
  };
  const html = overviewHtml({
    servers: servers.length,
    openReports: openReports.length,
    olderThan24h: openReports.filter((r) => new Date(r.createdAt).getTime() < cutoff).length,
    attention: openReports.slice(0, 3).map((r) => ({
      title: ISSUE_LABEL[r.issue] ?? r.issue,
      subtitle: `${r.server?.name ?? "—"} · reported by ${r.reporterMinecraftUsername} ${ago(new Date(r.createdAt))}`,
    })),
  });
  return <DesignScreen name="overview" html={html} />;
}

const ISSUE_LABEL: Record<string, string> = {
  cant_connect: "Can't connect to the server",
  wrong_version: "Wrong game version",
  modpack_download: "Modpack download failed",
  crash: "Game crashes",
  other: "Other problem",
};
