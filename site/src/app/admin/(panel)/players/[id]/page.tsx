import { notFound, redirect } from "next/navigation";
import { db, execSql } from "@/lib/db";
import { DesignScreen } from "@/components/admin/DesignScreen";
import { requireAdmin } from "@/app/admin/design/guard";
import { playerDetailHtml, type PlayerServerRow } from "@/app/admin/design/bind";

export const dynamic = "force-dynamic";

const SHORT_COUNT = 3;
const PAGE_SIZE = 5;

export default async function PlayerDetail() {
  await requireAdmin();
  // 2026-10-12 : page desactivee temporairement (perimetre admin reduit), voir
  // administration/page.tsx. Logique d'origine conservee ci-dessous (PlayerDetailOriginal,
  // non utilisee) pour reactivation future sans tout reecrire.
  redirect("/admin/servers");
}

async function PlayerDetailOriginal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const player = await db.orm.public.User.select("id", "name", "minecraftUuid", "createdAt", "lockedAt", "lockedReason", "lockedBy").where({ id }).first();
  if (!player) notFound();

  const [servers, warnings, notes] = await Promise.all([
    db.orm.public.Server.select("id", "name", "slug", "ip", "published", "isPrivate", "frozenAt").where({ ownerId: id }).orderBy((s) => s.createdAt.desc()).all(),
    db.orm.public.PlayerWarning.select("id", "reason", "createdBy", "createdAt").where({ userId: id }).orderBy((w) => w.createdAt.desc()).all(),
    db.orm.public.AdminNote.select("id", "text", "createdBy", "createdAt").where({ userId: id }).orderBy((n) => n.createdAt.desc()).all(),
  ]);
  const serverIds = servers.map((s) => s.id);
  // Signalements techniques scopes aux serveurs de ce joueur (WHERE serverId IN (...)) — avant,
  // ce fichier chargeait TOUS les signalements techniques de la plateforme puis filtrait en
  // memoire par serverIds, un aller-retour D1 qui grossit avec la plateforme entiere au lieu
  // de rester proportionnel aux serveurs de ce joueur. Le query-builder de db.ts n'a pas
  // d'operateur IN, donc requete SQL directe via execSql (comme ailleurs dans le panel admin).
  const myReports = serverIds.length
    ? ((await execSql(
        `SELECT "serverId", "status" FROM "report" WHERE "category" = 'technical' AND "serverId" IN (${serverIds.map(() => "?").join(",")})`,
        serverIds,
      )) as { serverId: string; status: string }[])
    : [];
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
    locked: player.lockedAt !== null,
    lockedReason: player.lockedReason,
    lockedBy: player.lockedBy,
    lockedAt: player.lockedAt,
    warnings,
    notes,
  });
  return <DesignScreen name="player-detail" html={html} />;
}
