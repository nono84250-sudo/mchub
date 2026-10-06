import { notFound } from "next/navigation";
import { db } from "@/prisma/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { serverDetailHtml } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

export default async function ServerDetail({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const server = await db.orm.public.Server.select("id", "slug", "name", "type", "published", "isPrivate", "frozenAt", "frozenReason", "frozenBy", "ip", "minecraftVersion", "curseforgeModpackName", "curseforgeModpackVersion")
    .include("owner", (o) => o.select("name"))
    .where({ slug })
    .first();
  if (!server) notFound();
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
    ip: server.ip,
    minecraftVersion: server.minecraftVersion,
    modpackName: server.curseforgeModpackName,
    modpackVersion: server.curseforgeModpackVersion,
  });
  return <DesignScreen name="server-detail" html={html} />;
}
