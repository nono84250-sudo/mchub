import { db } from "@/prisma/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { serversHtml, type ServerFilters } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminServers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const filters: ServerFilters = {
    q,
    status: ["live", "hidden", "private", "frozen"].includes(params.status ?? "") ? (params.status as ServerFilters["status"]) : "all",
    type: params.type === "vanilla" || params.type === "modded" ? params.type : "all",
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  };

  const [servers, openReports] = await Promise.all([
    db.orm.public.Server.select("id", "name", "slug", "ip", "type", "published", "isPrivate", "frozenAt", "playerCount", "playerCapacity", "lastPingedAt", "createdAt")
      .include("owner", (o) => o.select("name"))
      .orderBy((s) => s.createdAt.desc())
      .all(),
    db.orm.public.Report.select("serverId").where({ status: "new" }).all(),
  ]);

  // ponytail: filtre en mémoire sur tous les serveurs ; passer en requête SQL si la liste grossit beaucoup.
  const needle = q.toLowerCase();
  const matching = servers.filter(
    (s) =>
      (filters.status === "all" ||
        (filters.status === "frozen"
          ? s.frozenAt !== null
          : filters.status === "private"
            ? s.isPrivate
            : filters.status === "live"
              ? s.published
              : !s.published)) &&
      (filters.type === "all" || s.type === filters.type) &&
      (!needle ||
        s.name.toLowerCase().includes(needle) ||
        s.ip.toLowerCase().includes(needle) ||
        (s.owner?.name ?? "").toLowerCase().includes(needle)),
  );
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const shown = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const byServer = new Map<string, number>();
  for (const r of openReports) byServer.set(r.serverId, (byServer.get(r.serverId) ?? 0) + 1);

  const html = serversHtml({
    filters: { ...filters, page },
    totalAll: servers.length,
    total: matching.length,
    from: matching.length ? (page - 1) * PAGE_SIZE + 1 : 0,
    to: (page - 1) * PAGE_SIZE + shown.length,
    pageCount,
    rows: shown.map((s) => ({
      name: s.name,
      slug: s.slug,
      address: s.ip,
      owner: s.owner?.name ?? "—",
      type: s.type,
      published: s.published,
      isPrivate: s.isPrivate,
      frozen: s.frozenAt !== null,
      pinged: s.lastPingedAt != null,
      players: s.playerCount,
      capacity: s.playerCapacity ?? 0,
      openReports: byServer.get(s.id) ?? 0,
    })),
  });
  return <DesignScreen name="servers" html={html} />;
}
