import { db } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { playersHtml, type PlayerFilters } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminPlayers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const filters: PlayerFilters = { q, page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1) };

  // ponytail: filtre et compte en memoire (comme la liste des serveurs) ; passer en requete
  // SQL si le nombre de comptes grossit beaucoup.
  const [players, servers] = await Promise.all([
    db.orm.public.User.select("id", "name", "minecraftUuid", "createdAt").orderBy((u) => u.createdAt.desc()).all(),
    db.orm.public.Server.select("ownerId").all(),
  ]);
  const serverCountByOwner = new Map<string, number>();
  for (const s of servers) serverCountByOwner.set(s.ownerId, (serverCountByOwner.get(s.ownerId) ?? 0) + 1);

  const needle = q.toLowerCase();
  const matching = players.filter((p) => !needle || p.name.toLowerCase().includes(needle));
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const shown = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const html = playersHtml({
    filters: { ...filters, page },
    totalAll: players.length,
    total: matching.length,
    from: matching.length ? (page - 1) * PAGE_SIZE + 1 : 0,
    to: (page - 1) * PAGE_SIZE + shown.length,
    pageCount,
    rows: shown.map((p) => ({
      id: p.id,
      name: p.name,
      minecraftUuid: p.minecraftUuid,
      createdAt: p.createdAt,
      serverCount: serverCountByOwner.get(p.id) ?? 0,
    })),
  });
  return <DesignScreen name="player-detail" html={html} />;
}
