import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { playerDetailHtml, type PlayerServerRow } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

const SHORT_COUNT = 3;
const PAGE_SIZE = 5;

export default async function PlayerDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const player = await db.orm.public.User.select("id", "name", "minecraftUuid", "createdAt").where({ id }).first();
  if (!player) notFound();

  // ponytail: tout en memoire (comme les autres listes du panel) ; passer en requete SQL si un
  // compte finit par posseder beaucoup de serveurs.
  const [servers, reports] = await Promise.all([
    db.orm.public.Server.select("id", "name", "slug", "ip", "published", "isPrivate", "frozenAt").where({ ownerId: id }).orderBy((s) => s.createdAt.desc()).all(),
    db.orm.public.Report.select("serverId", "status").all(),
  ]);
  const serverIds = new Set(servers.map((s) => s.id));
  const myReports = reports.filter((r) => serverIds.has(r.serverId));
  const openByServer = new Map<string, number>();
  for (const r of myReports) if (r.status !== "resolved") openByServer.set(r.serverId, (openByServer.get(r.serverId) ?? 0) + 1);

  const toRow = (s: (typeof servers)[number]): PlayerServerRow => ({
    name: s.name,
    slug: s.slug,
    address: s.ip,
    published: s.published,
    isPrivate: s.isPrivate,
    frozen: s.frozenAt !== null,
    openReports: openByServer.get(s.id) ?? 0,
  });

  const serversOpen = query.serversOpen === "1";
  const pageCount = Math.max(1, Math.ceil(servers.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(query.serversPage ?? "1", 10) || 1), pageCount);
  const serversShown = serversOpen ? servers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toRow) : servers.slice(0, SHORT_COUNT).map(toRow);

  const html = playerDetailHtml({
    id: player.id,
    name: player.name,
    minecraftUuid: player.minecraftUuid,
    createdAt: player.createdAt,
    serversTotal: servers.length,
    serversFrozen: servers.filter((s) => s.frozenAt !== null).length,
    serversShown,
    serversOpen,
    serversPage: page,
    serversPageCount: pageCount,
    serversFrom: serversOpen && servers.length ? (page - 1) * PAGE_SIZE + 1 : 0,
    serversTo: serversOpen ? (page - 1) * PAGE_SIZE + serversShown.length : 0,
    reportsTotal: myReports.length,
    reportsOpen: myReports.filter((r) => r.status !== "resolved").length,
  });
  return <DesignScreen name="player-detail" html={html} />;
}
