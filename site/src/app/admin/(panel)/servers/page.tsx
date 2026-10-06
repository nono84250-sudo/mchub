import { db } from "@/prisma/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { serversHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

export default async function AdminServers() {
  await requireAdmin();
  const [servers, openReports] = await Promise.all([
    db.orm.public.Server.select("id", "name", "slug", "ip", "type", "published", "playerCount", "playerCapacity", "createdAt")
      .include("owner", (o) => o.select("name"))
      .orderBy((s) => s.createdAt.desc())
      .all(),
    db.orm.public.Report.select("serverId").where({ status: "new" }).all(),
  ]);
  const byServer = new Map<string, number>();
  for (const r of openReports) byServer.set(r.serverId, (byServer.get(r.serverId) ?? 0) + 1);
  const html = serversHtml({
    total: servers.length,
    rows: servers.slice(0, 50).map((s) => ({
      name: s.name,
      address: s.ip,
      owner: s.owner?.name ?? "—",
      type: s.type,
      published: s.published,
      players: s.playerCount ?? 0,
      capacity: s.playerCapacity ?? 0,
      openReports: byServer.get(s.id) ?? 0,
    })),
  });
  return <DesignScreen name="servers" html={html} />;
}
