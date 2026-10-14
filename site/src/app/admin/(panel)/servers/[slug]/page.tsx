import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { serverDetailHtml } from "@/app/admin/design/bind";
import { listReportsForServer, listBehaviorReportsForServer } from "@/lib/reports";
import { parseAppealHistory } from "@/lib/appeals";

export const dynamic = "force-dynamic";

export default async function ServerDetail({ params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin();
  const { slug } = await params;
  const server = await db.orm.public.Server.select(
    "id", "slug", "name", "type", "published", "isPrivate", "frozenAt", "frozenReason", "frozenBy", "verificationStatus",
    "ip", "minecraftVersion", "curseforgeModpackName", "curseforgeModpackVersion", "createdAt", "launchCount", "ownerId",
    "appealStatus", "appealAssignedAdminId", "appealHistory",
  )
    .include("owner", (o) => o.select("name"))
    .where({ slug })
    .first();
  if (!server) notFound();
  const [reports, behaviorReports] = await Promise.all([listReportsForServer(server.id), listBehaviorReportsForServer(server.id)]);
  const html = serverDetailHtml({
    id: server.id,
    slug: server.slug,
    name: server.name,
    owner: server.owner?.name ?? "—",
    type: server.type,
    published: server.published,
    isPrivate: server.isPrivate,
    frozenAt: server.frozenAt,
    frozenReason: server.frozenReason,
    frozenBy: server.frozenBy,
    verificationStatus: server.verificationStatus,
    ip: server.ip,
    minecraftVersion: server.minecraftVersion,
    modpackName: server.curseforgeModpackName,
    modpackVersion: server.curseforgeModpackVersion,
    createdAt: server.createdAt,
    launchCount: server.launchCount,
    reports,
    behaviorReports,
    ownerId: server.ownerId,
    appealStatus: server.appealStatus,
    appealAssignedAdminId: server.appealAssignedAdminId,
    appealHistory: parseAppealHistory(server.appealHistory),
    currentAdminUsername: admin.username,
  });
  return <DesignScreen name="server-detail" html={html} />;
}
